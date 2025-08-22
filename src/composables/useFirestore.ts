import { ref, watch } from 'vue';

// Lightweight composable to encapsulate Firestore logic used by Kaede_Vote.vue
export function useFirestore(pollId: any, themeRef: any) {
  const votes = ref<any[][]>([]);
  const isRealtimeConnected = ref(false);
  const connectingRealtime = ref(false);
  const isPollingFallback = ref(false);
  const realtimeError = ref('');

  let firebaseApp: any = null;
  let db: any = null;
  let votesColRef: any = null;

  // dynamic exports
  let collection: any, addDoc: any, serverTimestamp: any, query: any, orderBy: any, limit: any, getDocs: any, deleteDoc: any, doc: any, getFirestore: any, setDoc: any, getDoc: any;
  let firestoreMode = 'none';

  function updateVotesRef() {
    if (!db) return;
    const pid = (typeof pollId === 'string') ? pollId : pollId.value;
    const theme = themeRef?.value ?? 'main';
    votesColRef = collection(db, 'polls', pid, 'themes', theme, 'votes');
  }

  async function ensureFirestoreLite() {
    if (!firebaseApp) {
      const { initializeApp } = await import('firebase/app');
      const firebaseConfig = {
        apiKey: "AIzaSyB1ZKM2j8epqauRiYnlwd9GemHw5qltyOk",
        authDomain: "kaede-vote-back.firebaseapp.com",
        projectId: "kaede-vote-back",
        storageBucket: "kaede-vote-back.firebasestorage.app",
        messagingSenderId: "612230015492",
        appId: "1:612230015492:web:285cef7c4a267d0ecde351",
        measurementId: "G-SY3402QMCD"
      };
      firebaseApp = initializeApp(firebaseConfig);
    }
    if (firestoreMode === 'none') {
      const mod = await import('firebase/firestore/lite');
      ({ collection, addDoc, serverTimestamp, getDocs, deleteDoc, doc, getFirestore, setDoc, getDoc, query, orderBy, limit } = mod);
  db = getFirestore(firebaseApp);
  updateVotesRef();
  firestoreMode = 'lite';
  // NOTE: do not auto-start polling here to avoid unexpected reads from clients
  // Polling should be started explicitly by the app when needed via startPollingFallback()
    }
  }

  let unsubscribe: any = null;
  let pollTimer: any = 0;
  // last seen timestamp (ms) to detect new documents without fetching all docs every time
  let lastSeenMs: number | null = null;
  // diagnostic counters
  let diagLatestCheckCount = 0;
  let diagFullFetchCount = 0;
  let diagReportTimer: any = null;
  // pending clientIds for optimistic local votes
  const pendingClientIds = new Set<string>();

  async function connectRealtime() {
  // Realtime disabled: application configured to use polling-only to avoid excessive reads.
  console.info('[useFirestore] connectRealtime called but realtime is disabled; using polling only');
  realtimeError.value = 'リアルタイム接続は無効化されています（ポーリングのみ使用）';
  isRealtimeConnected.value = false;
  connectingRealtime.value = false;
  }

  function disconnectRealtime() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; console.debug('[useFirestore] disconnected realtime'); }
    if (pollTimer) { clearInterval(pollTimer); pollTimer = 0; }
    isRealtimeConnected.value = false;
    isPollingFallback.value = false;
  }

  function startPollingFallback() {
    isPollingFallback.value = true;
    if (pollTimer) clearInterval(pollTimer);
  // use a longer default interval to reduce reads
    pollTimer = setInterval(async () => {
      try {
        await ensureFirestoreLite();
        // First, fetch only the latest document's createdAt (cheap: limit 1)
        try {
          const latestQ = query(votesColRef, orderBy('createdAt', 'desc'), limit(1));
      const latestSnap = await getDocs(latestQ);
      diagLatestCheckCount++;
          let newestMs: number | null = null;
          latestSnap.forEach((d:any) => {
            const data = d.data();
            const ts = data?.createdAt;
            if (ts && typeof ts.toMillis === 'function') newestMs = ts.toMillis();
            else if (ts) newestMs = (new Date(ts)).getTime();
          });
          console.debug('[useFirestore] polling latest-check newestMs, lastSeenMs', newestMs, lastSeenMs);
          // if nothing changed, skip full fetch
          if (newestMs != null && newestMs === lastSeenMs) return;
          lastSeenMs = newestMs;
        } catch (e) {
          console.debug('[useFirestore] polling latest-check failed, will fallback to full fetch', e);
          // if the lightweight check fails, fall back to full fetch below
        }

  // Full fetch when change detected (or if lightweight check not available)
  const snap = await getDocs(votesColRef);
  diagFullFetchCount++;
  console.debug('[useFirestore] polling full fetch, docCount=', snap.size);
        const arrs: any[] = [];
        snap.forEach((d:any) => {
          const data = d.data();
          if (data && data.optionIndex != null && data.power != null) {
            const idxNum = Number(data.optionIndex);
            if (Number.isNaN(idxNum)) return;
            if (data.clientId && pendingClientIds.has(data.clientId)) { pendingClientIds.delete(data.clientId); return; }
            if (!arrs[idxNum]) arrs[idxNum] = [];
            const powerNum = (typeof data.power === 'number') ? data.power : (Number(data.power) || 0);
            arrs[idxNum].push({ power: powerNum, color: data.color || null, clientId: data.clientId || null });
          }
        });
        const maxIdx2 = arrs.length - 1;
        const out2:any[] = [];
        for (let i = 0; i <= maxIdx2; i++) out2[i] = arrs[i] || [];
        votes.value = out2;
      } catch (_) {}
    }, 10000);
    // start a diagnostic report timer (every 60s)
    if (!diagReportTimer) {
      diagReportTimer = setInterval(() => {
        console.info('[useFirestore][diag] latestChecks:', diagLatestCheckCount, 'fullFetches:', diagFullFetchCount);
        // reset counters
        diagLatestCheckCount = 0; diagFullFetchCount = 0;
      }, 60000);
    }
  }

  async function addVote(optionIndex:number, power:number, color?:string, clientId?:string) {
    await ensureFirestoreLite();
    const payload:any = { optionIndex, power, createdAt: serverTimestamp() };
    if (color) payload.color = color;
    if (clientId) payload.clientId = clientId;
    // return clientId used for dedup tracking
    await addDoc(votesColRef, payload);
    return clientId;
  }

  async function resetVotes() {
    await ensureFirestoreLite();
    const snap = await getDocs(votesColRef);
    const tasks:any[] = [];
    snap.forEach((d:any) => tasks.push(deleteDoc(doc(votesColRef, d.id))));
    await Promise.all(tasks);
    votes.value = [];
  }

  async function saveOptionsConfig(optionsArr:any[], optionColors:any[]) {
    await ensureFirestoreLite();
    const pid = (typeof pollId === 'string') ? pollId : pollId.value;
    const cfgRef = doc(db, 'polls', pid, 'themes', themeRef.value);
    await setDoc(cfgRef, { options: optionsArr, optionColors, updatedAt: new Date().toISOString() }, { merge: true });
  }

  async function loadOptionsConfig() {
    await ensureFirestoreLite();
    const pid = (typeof pollId === 'string') ? pollId : pollId.value;
    const cfgRef = doc(db, 'polls', pid, 'themes', themeRef.value);
    const snap = await getDoc(cfgRef);
    return snap.exists() ? snap.data() : null;
  }

  // watch theme changes to update ref
  if (themeRef && typeof themeRef === 'object' && 'value' in themeRef) {
    watch(themeRef, () => {
      updateVotesRef();
      // optionally restart connections in caller
    });
  }

  return {
    votes,
    connectRealtime,
    disconnectRealtime,
    addVote,
    loadOptionsConfig,
    saveOptionsConfig,
    resetVotes,
    ensureFirestoreLite,
  markPendingClientId: (id:string) => { if (id) pendingClientIds.add(id); },
    isRealtimeConnected,
    connectingRealtime,
    realtimeError,
    isPollingFallback,
  };
}
