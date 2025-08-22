import { createApp } from 'vue'
import { router } from './router'
import './style.css'
import App from './App.vue'

// 埋め込み環境（iframe）や許可外ホストでは analytics / GTM の読み込みを抑制
const isEmbedded = window.self !== window.top;
const allowedHosts = ['localhost', '127.0.0.1', 'your-production-domain.com'];
const isAllowedHost = allowedHosts.some(h => location.hostname.includes(h));

if (!isEmbedded && isAllowedHost) {
	// 本番環境での analytics 初期化や GTM ロードをここに書く
	// 例: GTM のスニペットや Segment のロード
	// (現状は無効化しておく)
	// loadAnalytics();
} else {
	// 開発/埋め込み環境では不要な外部ロードを抑制
	console.debug('Analytics disabled in embedded or non-allowed host environment', { isEmbedded, hostname: location.hostname });
}

createApp(App).use(router).mount('#app')

// StackBlitz 等の埋め込み環境で発生する "Could not find source file: 'stackblitz:/...'" の
// 未処理 Promise Rejection を抑制するための雑処理ハンドラ。
// 根本解決は環境側（StackBlitz）やソースマップの生成設定に依存しますが、
// 開発時のコンソールノイズを減らすためここでフィルタします。
window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
	try {
		const reason = (ev && (ev as any).reason) || '';
		const msg = typeof reason === 'string' ? reason : (reason && reason.message) || '';
		if (msg && (msg.includes('Could not find source file') || msg.includes('stackblitz:') || msg.includes('vite.config.ts.timestamp'))) {
			// ブラウザのデフォルトエラーハンドリングを抑制
			ev.preventDefault();
			console.debug('Suppressed known StackBlitz worker error:', msg);
		}
	} catch (e) { /* noop */ }
});
