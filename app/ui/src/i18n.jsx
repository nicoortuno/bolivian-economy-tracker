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

      kpi: {
        timestamp: 'Timestamp',
        mid: 'Mid',
        bestBidAsk: 'Best Bid/Best Ask',
        spreadBest: 'Spread % (best)',
        effSpread: 'Effective Spread %',
        depthImb: 'Depth Imbalance',
        medianGap: 'Median Gap',
        deltaMid: 'Δ Mid (1h)',
      },

      charts: {
        legendMid: 'Mid (BOB/USDT)',
        legendBestBid: 'Best Bid',
        legendBestAsk: 'Best Ask',
        legendSpreadBest: 'Spread % (best)',
        legendEffSpread: 'Effective Spread %',
        legendMarketWidth: 'Market Width %',
        legendBuyCount: 'Buy Count',
        legendSellCount: 'Sell Count',
        legendDepthImb: 'Depth Imbalance',
        legendVol24: 'Rolling 24h Vol',
        legendVol7d: 'Rolling 7d Vol',
        axisCounts: 'Counts',
        axisImb: 'Imbalance',
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

      kpi: {
        timestamp: 'Hora',
        mid: 'Mid',
        bestBidAsk: 'Mejor compra/mejor venta',
        spreadBest: 'Spread % (mejor)',
        effSpread: 'Spread efectivo %',
        depthImb: 'Desbalance de profundidad',
        medianGap: 'Gap mediano',
        deltaMid: 'Δ Mid (1h)',
      },

      charts: {
        legendMid: 'Mid (BOB/USDT)',
        legendBestBid: 'Mejor compra',
        legendBestAsk: 'Mejor venta',
        legendSpreadBest: 'Spread % (mejor)',
        legendEffSpread: 'Spread efectivo %',
        legendMarketWidth: 'Ancho de mercado %',
        legendBuyCount: 'Órdenes de compra',
        legendSellCount: 'Órdenes de venta',
        legendDepthImb: 'Desbalance de profundidad',
        legendVol24: 'Volumen móvil 24h',
        legendVol7d: 'Volumen móvil 7d',
        axisCounts: 'Recuentos',
        axisImb: 'Desbalance',
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
