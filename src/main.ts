import { createApp } from 'vue'
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

createApp(App).mount('#app')
