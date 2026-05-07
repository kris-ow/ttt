/**
 * Build the structured Knowledge Base from quarterly metrics, preserving
 * manually curated composite areas (trackers) from the existing KB file.
 *
 * Usage: node scripts/build-kb.js
 */

import fs from 'fs';
import path from 'path';

const QUARTERLY_FILE = path.resolve('src/data/quarterly-metrics.json');
const KB_FILE = path.resolve('src/data/knowledge-base.json');

const KB_SCHEMA = {
  "Autonomous Driving": {
    areas: [
      { id: "fsd_versions", name: "FSD Software Versions & Capabilities", type: "facts" },
      { id: "fsd_safety", name: "FSD Safety Metrics", type: "facts" },
      { id: "fsd_active_subs", name: "FSD Active Subscriptions", type: "metric", metricKey: "fsd_subscriptions_mil", unit: "million" },
      { id: "regulatory_us", name: "US Regulatory Status (Federal & State)", type: "facts" },
      { id: "regulatory_intl", name: "International Regulatory & Availability", type: "facts" },
    ],
  },
  "Robotaxi": {
    areas: [
      { id: "fleet_deployment", name: "Fleet Size & Deployment", type: "composite" },
      { id: "production_manufacturing", name: "Production & Manufacturing", type: "facts" },
      { id: "ride_volume", name: "Ride Volume & Demand", type: "facts" },
      { id: "pricing_revenue", name: "Pricing & Revenue", type: "facts" },
      { id: "operating_costs", name: "Operating Costs", type: "facts" },
      { id: "vehicle_capex", name: "Vehicle Cost (CapEx)", type: "facts" },
      { id: "competitor_comparison", name: "Competition", type: "facts" },
    ],
  },
  "Humanoid Bots": {
    areas: [
      { id: "optimus_hardware", name: "Optimus Generations & Capabilities", type: "facts" },
      { id: "optimus_production", name: "Production Targets & Actuals", type: "facts" },
      { id: "optimus_factory", name: "Factory Allocation", type: "facts" },
      { id: "optimus_economics", name: "Pricing & Unit Economics", type: "facts" },
      { id: "digital_optimus", name: "Digital Optimus / Macrohard", type: "facts" },
    ],
  },
  "Energy": {
    areas: [
      { id: "storage_deployed", name: "Energy Storage Deployed", type: "metric", metricKey: "storage_deployed_gwh", unit: "GWh" },
      { id: "energy_revenue", name: "Energy Revenue", type: "metric", metricKey: "revenue_energy", unit: "$M" },
      { id: "supercharger_stations", name: "Supercharger Stations", type: "metric", metricKey: "supercharger_stations", unit: "stations" },
      { id: "supercharger_connectors", name: "Supercharger Connectors", type: "metric", metricKey: "supercharger_connectors", unit: "connectors" },
      { id: "megapack_capacity", name: "Megapack Factory & Capacity", type: "facts" },
      { id: "battery_production", name: "Battery Production by Factory", type: "facts" },
      { id: "solar_deployed", name: "Solar Deployed", type: "metric", metricKey: "solar_deployed_mw", unit: "MW" },
    ],
  },
  "Electric Vehicles": {
    areas: [
      { id: "production_3y", name: "Model 3/Y Production", type: "metric", metricKey: "production_3y", unit: "units" },
      { id: "production_other", name: "Other Models Production", type: "metric", metricKey: "production_other", unit: "units" },
      { id: "production_total", name: "Total Production", type: "metric", metricKey: "production_total", unit: "units" },
      { id: "delivery_3y", name: "Model 3/Y Deliveries", type: "metric", metricKey: "delivery_3y", unit: "units" },
      { id: "delivery_other", name: "Other Models Deliveries", type: "metric", metricKey: "delivery_other", unit: "units" },
      { id: "delivery_total", name: "Total Deliveries", type: "metric", metricKey: "delivery_total", unit: "units" },
      { id: "revenue_auto", name: "Automotive Revenue", type: "metric", metricKey: "revenue_auto", unit: "$M" },
      { id: "factory_capacity", name: "Factory Capacity & Expansion", type: "facts" },
      { id: "new_models", name: "New Models (Semi, Roadster, $25K)", type: "facts" },
      { id: "market_share", name: "Market Share by Region", type: "facts" },
    ],
  },
  "Financials": {
    areas: [
      { id: "revenue_total", name: "Total Revenue", type: "metric", metricKey: "revenue_total", unit: "$M" },
      { id: "gross_margin", name: "Gross Margin", type: "metric", metricKey: "gross_margin_pct", unit: "%" },
      { id: "gross_profit", name: "Gross Profit", type: "metric", metricKey: "gross_profit", unit: "$M" },
      { id: "operating_margin", name: "Operating Margin", type: "metric", metricKey: "operating_margin_pct", unit: "%" },
      { id: "operating_income", name: "Operating Income", type: "metric", metricKey: "operating_income", unit: "$M" },
      { id: "net_income", name: "Net Income (GAAP)", type: "metric", metricKey: "net_income_gaap", unit: "$M" },
      { id: "eps", name: "EPS (GAAP)", type: "metric", metricKey: "eps_gaap", unit: "$" },
      { id: "ebitda", name: "Adjusted EBITDA", type: "metric", metricKey: "ebitda", unit: "$M" },
      { id: "operating_cash_flow", name: "Operating Cash Flow", type: "metric", metricKey: "operating_cash_flow", unit: "$M" },
      { id: "capex", name: "Capital Expenditures", type: "metric", metricKey: "capex", unit: "$M" },
      { id: "free_cash_flow", name: "Free Cash Flow", type: "metric", metricKey: "free_cash_flow", unit: "$M" },
      { id: "cash_balance", name: "Cash & Investments", type: "metric", metricKey: "cash_and_investments", unit: "$M" },
      { id: "institutional", name: "Institutional Ownership Moves", type: "facts" },
    ],
  },
  "Market & Competition": {
    areas: [
      { id: "ev_market", name: "Global EV Market Size & Growth", type: "facts" },
      { id: "tesla_share", name: "Tesla Market Share by Region", type: "facts" },
      { id: "byd", name: "BYD (Pricing, Expansion, Tech)", type: "facts" },
      { id: "waymo", name: "Waymo (Fleet, Economics, Regulation)", type: "facts" },
      { id: "legacy_oem", name: "Legacy OEM Struggles & Write-downs", type: "facts" },
      { id: "tariffs_policy", name: "Tariffs & Trade Policy", type: "facts" },
    ],
  },
};

function main() {
  let quarterlyMetrics = { metrics: {} };
  if (fs.existsSync(QUARTERLY_FILE)) {
    quarterlyMetrics = JSON.parse(fs.readFileSync(QUARTERLY_FILE, 'utf-8'));
    console.log(`Loaded quarterly metrics: ${Object.keys(quarterlyMetrics.metrics).length} metrics`);
  } else {
    console.log('No quarterly metrics file found, building KB with empty metric areas');
  }

  let existingKb = {};
  if (fs.existsSync(KB_FILE)) {
    existingKb = JSON.parse(fs.readFileSync(KB_FILE, 'utf-8'));
  }

  const kb = {};

  for (const [category, schema] of Object.entries(KB_SCHEMA)) {
    kb[category] = {
      areas: schema.areas.map(areaDef => {
        // Composite areas are manually curated — preserve from existing KB
        if (areaDef.type === "composite") {
          const existingArea = existingKb[category]?.areas?.find(a => a.id === areaDef.id);
          if (existingArea) {
            console.log(`  Preserving composite area: ${category} > ${areaDef.id}`);
            return existingArea;
          }
          return { id: areaDef.id, name: areaDef.name, type: "composite", sections: [] };
        }

        const area = { id: areaDef.id, name: areaDef.name, type: areaDef.type, facts: [] };

        if (areaDef.type === "metric") {
          area.unit = areaDef.unit;
          area.metricKey = areaDef.metricKey;

          const metricData = quarterlyMetrics.metrics[areaDef.metricKey];
          const quarterly = {};
          const annual = {};
          if (metricData) {
            for (const [period, value] of Object.entries(metricData)) {
              if (period.startsWith("Q")) quarterly[period] = value;
              else if (period.startsWith("FY")) annual[period] = value;
            }
          }
          area.quarterly = quarterly;
          area.annual = annual;
        }

        return area;
      }),
    };
  }

  fs.writeFileSync(KB_FILE, JSON.stringify(kb, null, 2));

  console.log(`\nKB Structure:`);
  for (const [category, data] of Object.entries(kb)) {
    const metricAreas = data.areas.filter(a => a.type === "metric");
    const totalMetricPoints = metricAreas.reduce((sum, a) => {
      return sum + Object.keys(a.quarterly || {}).length + Object.keys(a.annual || {}).length;
    }, 0);
    const compositeAreas = data.areas.filter(a => a.type === "composite").length;
    console.log(`  ${category}: ${metricAreas.length} metric areas (${totalMetricPoints} data points), ${compositeAreas} composite areas`);
  }

  console.log(`\nWritten to ${KB_FILE}`);
}

main();
