// i18n.js
import { createContext, useContext, useState } from 'react'

const I18nContext = createContext()

const messages = {
  en: {
    nav: {
      overview: 'Overview',
      currency: 'Currency',
      macro: 'Macro',
      news: 'News',
    },
    home: {
      title: 'Economic Overview',
      keyMacroTitle: 'Key Macro Indicators',
      inflYoY: 'Inflation YoY',
      inflMoM: 'Inflation MoM',
      netRes: 'Net Reserves (BOB Thousands)',
      tradeBalance: 'Trade Balance (USD Millions)',
      latestCurrencyTitle: 'Latest Currency Insights',
      bidAskAvg: 'Bid/Ask average',
      bestBidAsk: 'Best Bid/Best Ask',
      spreadPct: 'Spread %',
      ts: 'Timestamp',
      latestNewsTitle: 'Latest Economic News',
      newsSubtitle: 'From El Deber (Economía) summaries',
      disclaimerTitle: 'Disclaimer:',
      disclaimerBody:
        'This feature is in beta. AI-generated summaries may contain mistakes — please interpret with caution.',
      loadingPrice: 'Loading latest price…',
      loadingNews: 'Loading news…',
      noNewsToday: 'No summaries yet for today.',
      chartTime: 'Time',
      chartPair: 'BOB / USDT',
    },
    currency: {
      title: 'Currency (USDT ⇄ BOB)',
      loading: 'Loading data…',
      ranges: {
        '1D': '1D',
        '1W': '1W',
        '1M': '1M',
      },
      kpi: {
        timestamp: 'Timestamp',
        mid: 'Mid',
        bestBidAsk: 'Best Bid / Best Ask',
        spreadBest: 'Spread % (best)',
        effSpread: 'Effective Spread %',
        depthImb: 'Depth Imbalance',
        medianGap: 'Median Gap',
        deltaMid: 'Δ Mid (1h)',
      },
      series: {
        mid: 'Mid (BOB/USDT)',
        bestBid: 'Best Bid',
        bestAsk: 'Best Ask',
        spreadBest: 'Spread % (best)',
        effSpread: 'Effective Spread %',
        marketWidth: 'Market Width %',
        buyCount: 'Buy Count',
        sellCount: 'Sell Count',
        depthImb: 'Depth Imbalance',
        vol24: 'Rolling 24h Vol',
        vol7d: 'Rolling 7d Vol',
      },
      axis: {
        counts: 'Counts',
        imbalance: 'Imbalance',
      },
    },
  },

  es: {
    nav: {
      overview: 'Panorama',
      currency: 'Divisas',
      macro: 'Macro',
      news: 'Noticias',
    },
    home: {
      title: 'Panorama económico',
      keyMacroTitle: 'Indicadores macroeconómicos clave',
      inflYoY: 'Inflación interanual',
      inflMoM: 'Inflación mensual',
      netRes: 'Reservas netas (miles de BOB)',
      tradeBalance: 'Balanza comercial (millones de USD)',
      latestCurrencyTitle: 'Últimas señales del mercado cambiario',
      bidAskAvg: 'Promedio compra/venta',
      bestBidAsk: 'Mejor compra / mejor venta',
      spreadPct: 'Spread %',
      ts: 'Hora',
      latestNewsTitle: 'Últimas noticias económicas',
      newsSubtitle: 'Resúmenes de El Deber (Economía)',
      disclaimerTitle: 'Aviso:',
      disclaimerBody:
        'Esta función está en beta. Los resúmenes generados con IA pueden contener errores — interprétalos con cautela.',
      loadingPrice: 'Cargando precio más reciente…',
      loadingNews: 'Cargando noticias…',
      noNewsToday: 'Todavía no hay resúmenes para hoy.',
      chartTime: 'Hora',
      chartPair: 'BOB / USDT',
    },
    currency: {
      title: 'Divisas (USDT ⇄ BOB)',
      loading: 'Cargando datos…',
      ranges: {
        '1D': '1D',
        '1W': '1S',
        '1M': '1M',
      },
      kpi: {
        timestamp: 'Hora',
        mid: 'Mid',
        bestBidAsk: 'Mejor compra / mejor venta',
        spreadBest: 'Spread % (mejor)',
        effSpread: 'Spread efectivo %',
        depthImb: 'Desbalance de profundidad',
        medianGap: 'Brecha mediana',
        deltaMid: 'Δ Mid (1h)',
      },
      series: {
        mid: 'Mid (BOB/USDT)',
        bestBid: 'Mejor compra',
        bestAsk: 'Mejor venta',
        spreadBest: 'Spread % (mejor)',
        effSpread: 'Spread efectivo %',
        marketWidth: 'Ancho de mercado %',
        buyCount: 'Órdenes de compra',
        sellCount: 'Órdenes de venta',
        depthImb: 'Desbalance de profundidad',
        vol24: 'Volumen 24h',
        vol7d: 'Volumen 7 días',
      },
      axis: {
        counts: 'Conteos',
        imbalance: 'Desbalance',
      },
    },
  },
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState('en')

  const t = (key) => {
    const parts = key.split('.')
    let obj = messages[lang]
    for (const p of parts) {
      obj = obj?.[p]
      if (!obj) break
    }
    return obj ?? key
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
