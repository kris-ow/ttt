/**
 * Build the structured Knowledge Base from:
 * 1. Quarterly metrics (extracted from shareholder decks)
 * 2. Existing facts (from current knowledge-base.json)
 *
 * Output: src/data/knowledge-base.json with new unified schema
 *
 * Usage: node scripts/build-kb.js
 */

import fs from 'fs';
import path from 'path';

const QUARTERLY_FILE = path.resolve('src/data/quarterly-metrics.json');
const KB_FILE = path.resolve('src/data/knowledge-base.json');

// ── KB Category & Area Definitions ─────────────────────────

const KB_SCHEMA = {
  "Autonomous Driving": {
    areas: [
      { id: "fsd_versions", name: "FSD Software Versions & Capabilities", type: "facts" },
      { id: "fsd_safety", name: "FSD Safety Metrics", type: "facts" },
      { id: "fsd_take_rate", name: "FSD Subscription Take Rate", type: "metric", metricKey: "fsd_subscriptions_mil", unit: "million" },
      { id: "regulatory_us", name: "US Regulatory Status (Federal & State)", type: "facts" },
      { id: "regulatory_intl", name: "International Regulatory & Availability", type: "facts" },
    ],
  },
  "Robotaxi": {
    areas: [
      { id: "cybercab_production", name: "Cybercab Production & Units", type: "facts" },
      { id: "fleet_size", name: "Fleet Size by City", type: "facts" },
      { id: "rides_economics", name: "Rides & Revenue per Ride", type: "facts" },
      { id: "unit_economics", name: "Unit Economics", type: "facts" },
      { id: "city_rollout", name: "City Rollout Status", type: "facts" },
      { id: "competitor_robotaxi", name: "Competitor Comparison (Waymo, Uber/Nvidia)", type: "facts" },
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

// ── Map existing facts to areas ─────────────────────────────

// Keywords to match existing facts to areas (best-effort auto-mapping)
const FACT_AREA_RULES = [
  // Autonomous Driving
  { pattern: /FSD.*version|v\d+\.\d+|FSD.*update|FSD.*release/i, area: "fsd_versions", category: "Autonomous Driving" },
  { pattern: /FSD.*safe|crash rate|miles per.*incident|incident.*report/i, area: "fsd_safety", category: "Autonomous Driving" },
  { pattern: /FSD.*subscri/i, area: "fsd_take_rate", category: "Autonomous Driving" },
  { pattern: /NHTSA|Self-Drive Act|FMVSS|steering wheel.*pedal|regulatory|UNECE/i, area: "regulatory_us", category: "Autonomous Driving" },
  { pattern: /FSD.*launch|FSD.*approv|Netherlands|Europe.*FSD|China.*FSD|Japan.*FSD|UAE|Korea.*FSD|Australia.*FSD/i, area: "regulatory_intl", category: "Autonomous Driving" },
  { pattern: /Lemonade|insurance.*FSD/i, area: "fsd_safety", category: "Autonomous Driving" },
  { pattern: /fleet.*data|billion.*miles|cumulative.*miles|Ashok/i, area: "fsd_versions", category: "Autonomous Driving" },
  { pattern: /FSD.*discontinu|FSD.*subscript.*only/i, area: "fsd_take_rate", category: "Autonomous Driving" },

  // Robotaxi
  { pattern: /Cybercab.*produc|Cybercab.*roll|Cybercab.*line|Cybercab.*unit|Cybercab.*built/i, area: "cybercab_production", category: "Robotaxi" },
  { pattern: /Cybercab.*price|Cybercab.*cost|under \$30|unboxed/i, area: "unit_economics", category: "Robotaxi" },
  { pattern: /Cybercab.*no steering|Cybercab.*seat|Cybercab.*design|inductive charg/i, area: "cybercab_production", category: "Robotaxi" },
  { pattern: /fleet.*grew|fleet.*vehicle|robotaxi.*fleet|unsupervised|driverless/i, area: "fleet_size", category: "Robotaxi" },
  { pattern: /robotaxi.*city|expansion.*city|Austin|Dallas|Houston|Phoenix|Miami|Orlando|Tampa|Las Vegas/i, area: "city_rollout", category: "Robotaxi" },
  { pattern: /robotaxi.*pric|\$.*per.*mile|ride.*revenue|ride.*cost|margin.*robotaxi/i, area: "rides_economics", category: "Robotaxi" },
  { pattern: /robotaxi.*app|Android/i, area: "city_rollout", category: "Robotaxi" },
  { pattern: /Waymo.*incident|Waymo.*fleet|Waymo.*ride|Waymo.*city|Waymo.*raised|Waymo.*unprofit/i, area: "competitor_robotaxi", category: "Robotaxi" },
  { pattern: /Nvidia.*Uber|Nvidia.*robotaxi/i, area: "competitor_robotaxi", category: "Robotaxi" },

  // Humanoid Bots
  { pattern: /Optimus.*Gen|Optimus.*V\d|Optimus.*hand|Optimus.*degree/i, area: "optimus_hardware", category: "Humanoid Bots" },
  { pattern: /Optimus.*produc|Optimus.*unit|50,000.*Optimus|Optimus.*target|Fremont.*Optimus/i, area: "optimus_production", category: "Humanoid Bots" },
  { pattern: /Optimus.*factory|Optimus.*Fremont|Model S.*end|Model X.*end|Giga Texas North/i, area: "optimus_factory", category: "Humanoid Bots" },
  { pattern: /Optimus.*price|Optimus.*\$\d/i, area: "optimus_economics", category: "Humanoid Bots" },
  { pattern: /Digital Optimus|Macrohard|AI4.*chip|gymnasium/i, area: "digital_optimus", category: "Humanoid Bots" },

  // Energy
  { pattern: /Megapack|Brookshire/i, area: "megapack_capacity", category: "Energy" },
  { pattern: /battery.*factor|LG Energy|LFP.*factory|battery.*tax credit|lithium refin|4680|GWh.*capacity/i, area: "battery_production", category: "Energy" },
  { pattern: /Supercharger.*network|75,000.*stall|V4 Supercharger|Supercharger.*convert|Supercharger.*AI/i, area: "supercharger_stations", category: "Energy" },

  // Electric Vehicles
  { pattern: /Model Y.*refresh|Model Y.*Long|Cybertruck.*price|Cybertruck.*demand/i, area: "new_models", category: "Electric Vehicles" },
  { pattern: /Tesla Semi|Semi.*spec|Semi.*price|Semi.*produc/i, area: "new_models", category: "Electric Vehicles" },
  { pattern: /Roadster.*unveil|Roadster.*spec/i, area: "new_models", category: "Electric Vehicles" },
  { pattern: /deliver.*1\.\d.*million|deliver.*vehicle.*202/i, area: "delivery_total", category: "Electric Vehicles" },
  { pattern: /US EV.*share|market share.*reboun/i, area: "market_share", category: "Electric Vehicles" },
  { pattern: /Europe.*sales.*decline/i, area: "market_share", category: "Electric Vehicles" },
  { pattern: /Model S.*end|Model X.*end/i, area: "new_models", category: "Electric Vehicles" },
  { pattern: /Giga.*expan|factory.*capacity|million sq ft/i, area: "factory_capacity", category: "Electric Vehicles" },

  // Financials
  { pattern: /capex|\$.*billion.*capex|capital.*expenditure/i, area: "capex", category: "Financials" },
  { pattern: /free cash flow/i, area: "free_cash_flow", category: "Financials" },
  { pattern: /cash.*balance|\$44.*billion.*cash/i, area: "cash_balance", category: "Financials" },
  { pattern: /services.*revenue.*grow/i, area: "revenue_total", category: "Financials" },
  { pattern: /Terrafab|Samsung.*chip|Samsung.*wafer/i, area: "capex", category: "Financials" },
  { pattern: /institutional|13F|Norges|Geode|Renaissance|Musk.*purchas|Musk.*share/i, area: "institutional", category: "Financials" },
  { pattern: /SpaceX.*equity|xAI.*invest/i, area: "institutional", category: "Financials" },

  // Market & Competition
  { pattern: /global EV.*sale|global EV.*grew|IEA/i, area: "ev_market", category: "Market & Competition" },
  { pattern: /BYD.*charg|BYD.*expan|BYD.*factor|BYD.*order|BYD.*pric/i, area: "byd", category: "Market & Competition" },
  { pattern: /Xpeng|XIMO|Volkswagen.*autonom/i, area: "byd", category: "Market & Competition" },
  { pattern: /Honda.*loss|Stellantis.*write|Ford.*write|GM.*write|legacy.*OEM/i, area: "legacy_oem", category: "Market & Competition" },
  { pattern: /Rivian.*R2|Rivian.*pric|BMW.*Level 3|Mercedes.*Level 3/i, area: "legacy_oem", category: "Market & Competition" },
  { pattern: /China.*export|tariff/i, area: "tariffs_policy", category: "Market & Competition" },
];

function matchFactToArea(fact, originalCategory) {
  // Try rules first
  for (const rule of FACT_AREA_RULES) {
    if (rule.pattern.test(fact.fact)) {
      return { area: rule.area, category: rule.category };
    }
  }
  // Fallback: put in first area of the original category
  const schema = KB_SCHEMA[originalCategory];
  if (schema) {
    const firstFactArea = schema.areas.find(a => a.type === "facts");
    if (firstFactArea) {
      return { area: firstFactArea.id, category: originalCategory };
    }
  }
  return null;
}

// ── Main Build ──────────────────────────────────────────────

function main() {
  // Load quarterly metrics
  let quarterlyMetrics = { metrics: {} };
  if (fs.existsSync(QUARTERLY_FILE)) {
    quarterlyMetrics = JSON.parse(fs.readFileSync(QUARTERLY_FILE, 'utf-8'));
    console.log(`Loaded quarterly metrics: ${Object.keys(quarterlyMetrics.metrics).length} metrics`);
  } else {
    console.log('No quarterly metrics file found, building KB with facts only');
  }

  // Load existing facts
  let existingFacts = {};
  if (fs.existsSync(KB_FILE)) {
    existingFacts = JSON.parse(fs.readFileSync(KB_FILE, 'utf-8'));
    const totalFacts = Object.values(existingFacts).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`Loaded existing KB: ${totalFacts} facts across ${Object.keys(existingFacts).length} categories`);
  }

  // Build new KB structure
  const kb = {};

  for (const [category, schema] of Object.entries(KB_SCHEMA)) {
    kb[category] = {
      areas: schema.areas.map(areaDef => {
        const area = {
          id: areaDef.id,
          name: areaDef.name,
          type: areaDef.type,
        };

        if (areaDef.type === "metric") {
          area.unit = areaDef.unit;
          area.metricKey = areaDef.metricKey;

          // Pull time-series data from quarterly metrics
          const metricData = quarterlyMetrics.metrics[areaDef.metricKey];
          if (metricData) {
            // Split into quarterly and annual
            const quarterly = {};
            const annual = {};
            for (const [period, value] of Object.entries(metricData)) {
              if (period.startsWith("Q")) {
                quarterly[period] = value;
              } else if (period.startsWith("FY")) {
                annual[period] = value;
              }
            }
            area.quarterly = quarterly;
            area.annual = annual;
          } else {
            area.quarterly = {};
            area.annual = {};
          }

          // Metric areas can also have facts (forward estimates, context)
          area.facts = [];
        } else {
          area.facts = [];
        }

        return area;
      }),
    };
  }

  // Assign existing facts to areas
  let assigned = 0;
  let unassigned = 0;

  for (const [category, facts] of Object.entries(existingFacts)) {
    // Skip if it's the new format already
    if (!Array.isArray(facts)) continue;

    for (const fact of facts) {
      const match = matchFactToArea(fact, category);
      if (match) {
        const catData = kb[match.category];
        if (catData) {
          const area = catData.areas.find(a => a.id === match.area);
          if (area) {
            area.facts.push({
              fact: fact.fact,
              lastUpdated: fact.lastUpdated,
              sources: fact.sources,
            });
            assigned++;
            continue;
          }
        }
      }
      unassigned++;
      console.log(`  Unassigned: "${fact.fact.slice(0, 80)}..." (${category})`);
    }
  }

  console.log(`\nFact assignment: ${assigned} assigned, ${unassigned} unassigned`);

  // Write output
  fs.writeFileSync(KB_FILE, JSON.stringify(kb, null, 2));

  // Summary
  console.log(`\nKB Structure:`);
  for (const [category, data] of Object.entries(kb)) {
    const metricAreas = data.areas.filter(a => a.type === "metric");
    const factAreas = data.areas.filter(a => a.type === "facts");
    const totalFacts = data.areas.reduce((sum, a) => sum + (a.facts?.length || 0), 0);
    const totalMetricPoints = metricAreas.reduce((sum, a) => {
      return sum + Object.keys(a.quarterly || {}).length + Object.keys(a.annual || {}).length;
    }, 0);
    console.log(`  ${category}: ${metricAreas.length} metric areas (${totalMetricPoints} data points), ${factAreas.length} fact areas (${totalFacts} facts)`);
  }

  console.log(`\nWritten to ${KB_FILE}`);
}

main();
