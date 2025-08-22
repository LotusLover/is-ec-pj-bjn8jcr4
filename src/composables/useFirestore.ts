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
  let collection: any, addDoc: any, serverTimestamp: any, onSnapshot: any, query: any, orderBy: any, getDocs: any, deleteDoc: any, doc: any, getFirestore: any, setDoc: any, getDoc: any;
  let enableMultiTabIndexedDbPersistence: any;
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
      ({ collection, addDoc, serverTimestamp, getDocs, deleteDoc, doc, getFirestore, setDoc, getDoc } = mod);
      db = getFirestore(firebaseApp);
      updateVotesRef();
      firestoreMode = 'lite';
  // start lightweight polling so clients receive updates even without explicit realtime connect
  try { startPollingFallback(); } catch (_) {}
    }
  }

  let unsubscribe: any = null;
  let pollTimer: any = 0;
  // pending clientIds for optimistic local votes
  const pendingClientIds = new Set<string>();

  async function connectRealtime() {
    if (unsubscribe) return;
    connectingRealtime.value = true;
    realtimeError.value = '';
    try {
      await ensureFirestoreLite();
      if (!firebaseApp) return;
      if (firestoreMode !== 'full') {
        const mod = await import('firebase/firestore');
        ({ collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, getDocs, deleteDoc, doc, getFirestore, setDoc, getDoc, enableMultiTabIndexedDbPersistence } = mod);
        db = getFirestore(firebaseApp);
        try { if (typeof enableMultiTabIndexedDbPersistence === 'function') await enableMultiTabIndexedDbPersistence(db); } catch (_) { /* noop */ }
        updateVotesRef();
        firestoreMode = 'full';
      }
      const q = query(votesColRef, orderBy('createdAt', 'asc'));
      unsubscribe = onSnapshot(q, (snap: any) => {
        const arrs: any[] = [];
        // initialize based on theme config length later; for now collect into map
        snap.forEach((d: any) => {
          const data = d.data();
          if (typeof data.optionIndex === 'number' && typeof data.power === 'number') {
            // skip server doc if it's already pending locally
            if (data.clientId && pendingClientIds.has(data.clientId)) {
              // clear pending flag and skip adding (we already showed it locally)
              pendingClientIds.delete(data.clientId);
              return;
            }
            if (!arrs[data.optionIndex]) arrs[data.optionIndex] = [];
            // preserve per-vote color if present
            arrs[data.optionIndex].push({ power: data.power, color: data.color || null });
          }
        });
        // normalize to arrays
        votes.value = arrs.map((a: any) => a || []);
      }, (err:any) => {
        realtimeError.value = 'リアルタイム接続に失敗: ' + (err?.message || err);
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        startPollingFallback();
      });
      isRealtimeConnected.value = true;
      if (pollTimer) { clearInterval(pollTimer); pollTimer = 0; }
      isPollingFallback.value = false;
    } catch (e:any) {
      realtimeError.value = '接続初期化でエラー: ' + (e?.message || e);
      startPollingFallback();
    } finally {
      connectingRealtime.value = false;
    }
  }

  function disconnectRealtime() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    if (pollTimer) { clearInterval(pollTimer); pollTimer = 0; }
    isRealtimeConnected.value = false;
    isPollingFallback.value = false;
  }

  function startPollingFallback() {
    isPollingFallback.value = true;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      try {
        await ensureFirestoreLite();
        const snap = await getDocs(votesColRef);
        const arrs: any[] = [];
        snap.forEach((d:any) => {
          const data = d.data();
          if (typeof data.optionIndex === 'number' && typeof data.power === 'number') {
            if (data.clientId && pendingClientIds.has(data.clientId)) { pendingClientIds.delete(data.clientId); return; }
            if (!arrs[data.optionIndex]) arrs[data.optionIndex] = [];
            arrs[data.optionIndex].push({ power: data.power, color: data.color || null });
          }
        });
        votes.value = arrs.map((a:any) => a || []);
      } catch (_) {}
    }, 2000);
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
