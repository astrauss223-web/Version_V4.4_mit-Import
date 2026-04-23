// ============================================================
//  V4.4 – Robustes Portfolio
//  NEU: PDF-Portfolio-Import + "Fonds delistet" je Schicht
//  Basis: V4.3.3.7
// ============================================================

// ── LAYER COLOURS (passend zu CSS data-block-id) ─────────────
const layerColors = {
    "block-kasse": "#FFB300",
    "block-defensiv": "#6E9E2E",
    "block-ausgewogen": "#8CC63F",
    "block-dynamisch": "#A8D84E",
    "block-maerkte": "#5D9CEC",
    "block-spezial": "#00B1EB",
    "block-tagesgeld": "#FFCA28"
};

// ── DATA ─────────────────────────────────────────────────────
const zeitphasen = [
    { id: "phase1", name: "Zeitphase 1", duration: "< 1 Jahr", assetClass: "Geldmarkt", mappedBlocks: ["block-kasse"], exactMatchBlock: "block-kasse" },
    { id: "phase2", name: "Zeitphase 2", duration: "> 2 Jahre", assetClass: "WB Anleihen, EB Anleihen", mappedBlocks: ["block-kasse", "block-defensiv"], exactMatchBlock: "block-defensiv" },
    { id: "phase3", name: "Zeitphase 3", duration: "> 4 Jahre", assetClass: "WB Anleihen, EB Anleihen", mappedBlocks: ["block-kasse", "block-defensiv", "block-ausgewogen"], exactMatchBlock: "block-ausgewogen" },
    { id: "phase4", name: "Zeitphase 4", duration: "> 6 Jahre", assetClass: "WB Aktien / Anleihen", mappedBlocks: ["block-kasse", "block-defensiv", "block-ausgewogen", "block-dynamisch"], exactMatchBlock: "block-dynamisch" },
    { id: "phase5", name: "Zeitphase 5", duration: "> 10 Jahre", assetClass: "WB Aktien", mappedBlocks: ["block-kasse", "block-defensiv", "block-ausgewogen", "block-dynamisch", "block-maerkte", "block-spezial"], exactMatchBlock: "block-maerkte" },
    { id: "phase6", name: "Zeitphase 6", duration: "> 10 Jahre", assetClass: "EB Aktien", mappedBlocks: ["block-kasse", "block-defensiv", "block-ausgewogen", "block-dynamisch", "block-maerkte", "block-spezial"], exactMatchBlock: "block-maerkte" }
];

// managementBlocks data has been moved to fund_data.js

// ── PORTFOLIO STATE ───────────────────────────────────────────
const STORAGE_KEY  = 'portfolioV44_setup';
const GLOBALS_KEY  = 'portfolioGlobalsV44_setup';
const CRAWLER_PORT = 8765;

// ── V4.4: "Fonds delistet" – virtuelle Fonds je Schicht ──────
// Gibt den virtuellen Delistet-Fondsnamen für eine Schicht zurück
const delistetFundName = (blockTitle) => `${blockTitle} – Fonds delistet`;

// Fügt den Delistet-Fonds zu jedem Block als letzten Eintrag hinzu (einmalig)
function ensureDelistetFunds() {
    managementBlocks.forEach(block => {
        const name = delistetFundName(block.title);
        if (!block.funds.some(f => f.name === name)) {
            block.funds.push({
                name,
                info: 'Fonds aus der VEM-Liste entfernt, aber noch im Depot',
                type: 'Delistet',
                ertrag: '',
                _isDelistet: true
            });
        }
    });
}
ensureDelistetFunds();

// portfolio = [{ blockId, blockTitle, allocation: Number, funds:[{name,info,type,ertrag}] }]
let portfolio = loadPortfolio();

function loadPortfolio() {
    try { const r = localStorage.getItem(STORAGE_KEY); if (r) return JSON.parse(r); } catch (e) { }
    return [];
}
function savePortfolio() { localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio)); }

function loadGlobals() {
    try { const r = localStorage.getItem(GLOBALS_KEY); if (r) return JSON.parse(r); } catch (e) { }
    return {
        totalInvestment: 0,
        totalSparrate: 0,
        fundInvestments: {},
        fundSparrates: {}
    };
}
let portfolioGlobals = loadGlobals();
function saveGlobals() { localStorage.setItem(GLOBALS_KEY, JSON.stringify(portfolioGlobals)); }

// ── MIGRATIONS-FIX (V4.4.1): totalInvestment-Korrektur ───────
// Falls der gespeicherte totalInvestment-Wert kleiner ist als die
// Summe aller fundInvestments (Bug aus V4.4.0), wird er automatisch
// auf die korrekte Summe korrigiert.
(function fixTotalInvestmentIfNeeded() {
    const sumAllFunds = Object.values(portfolioGlobals.fundInvestments || {}).reduce((s, v) => s + v, 0);
    if (sumAllFunds > 0 && portfolioGlobals.totalInvestment < sumAllFunds) {
        portfolioGlobals.totalInvestment = sumAllFunds;
        localStorage.setItem(GLOBALS_KEY, JSON.stringify(portfolioGlobals));
    }
})();

function getOrCreateLayer(blockId, blockTitle) {
    let layer = portfolio.find(l => l.blockId === blockId);
    if (!layer) {
        layer = { blockId, blockTitle, allocation: 0, funds: [] };
        const order = managementBlocks.map(b => b.id);
        const idx = order.indexOf(blockId);
        const at = portfolio.findIndex(l => order.indexOf(l.blockId) > idx);
        if (at === -1) portfolio.push(layer); else portfolio.splice(at, 0, layer);
    }
    return layer;
}

function isFundSelected(blockId, fundName) {
    const l = portfolio.find(l => l.blockId === blockId);
    return l ? l.funds.some(f => f.name === fundName) : false;
}

function addFund(block, fund) {
    const layer = getOrCreateLayer(block.id, block.title);
    if (!isFundSelected(block.id, fund.name))
        layer.funds.push({ name: fund.name, info: fund.info, type: fund.type, ertrag: fund.ertrag });
    savePortfolio();
}

function removeFund(blockId, fundName) {
    const layer = portfolio.find(l => l.blockId === blockId);
    if (layer) {
        const idx = layer.funds.findIndex(f => f.name === fundName);
        if (idx > -1) {
            layer.funds.splice(idx, 1);
            if (layer.funds.length === 0) {
                portfolio = portfolio.filter(l => l.blockId !== blockId);
            }
            delete portfolioGlobals.fundInvestments[`${blockId}::${fundName}`];
            delete portfolioGlobals.fundSparrates[`${blockId}::${fundName}`];
            saveGlobals(); // Save globals after deleting fund data
        }
    }
    savePortfolio();
}

function setLayerAllocation(blockId, value) {
    const layer = portfolio.find(l => l.blockId === blockId);
    if (layer) { layer.allocation = Math.max(0, Math.min(100, Number(value) || 0)); savePortfolio(); }
}

function resetPortfolio() { portfolio = []; savePortfolio(); }

// ── HEADER HEIGHT SYNC (fixes sticky panel offset) ───────────
function syncHeaderHeight() {
    const hdr = document.querySelector('.mlp-header');
    if (!hdr) return;
    const h = hdr.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--header-height', h + 'px');
}
document.addEventListener('DOMContentLoaded', syncHeaderHeight);
window.addEventListener('resize', syncHeaderHeight);

// ── MAIN ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

    const timelineContainer = document.getElementById('timeline-container');
    const towerContainer = document.getElementById('tower-container');
    const sideTowerContainer = document.getElementById('side-tower-container');
    const detailPhaseName = document.getElementById('detail-phase-name');
    const detailDuration = document.getElementById('detail-duration');
    const detailAssetClass = document.getElementById('detail-asset-class');
    const detailCard = document.getElementById('phase-detail-card');
    const modal = document.getElementById('funds-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalList = document.getElementById('modal-funds-list');
    const modalFilter = document.getElementById('modal-filter');
    const closeBtn = document.querySelector('#funds-modal .close-modal');
    const totalInvestmentInput = document.getElementById('total-investment-input');
    const totalDistributedDisplay = document.getElementById('total-distributed-display');
    const totalRemainingDisplay = document.getElementById('total-remaining-display');
    const totalInvestmentSparrate = document.getElementById('total-investment-sparrate');
    const sparrateDistributedDisplay = document.getElementById('sparrate-distributed-display');
    const sparrateRemainingDisplay = document.getElementById('sparrate-remaining-display');
    const layerBreakdownList = document.getElementById('layer-breakdown-list');
    const printOverallBtn = document.getElementById('print-overall-btn');
    const panelEmpty = document.getElementById('panel-empty');
    const panelLayers = document.getElementById('panel-layers');
    const allocTotal = document.getElementById('alloc-total');
    const allocBarFill = document.getElementById('alloc-bar-fill');
    const resetBtn = document.getElementById('reset-portfolio-btn');
    const savePortfolioBtn = document.getElementById('save-portfolio-btn');
    const exportSetupBtn = document.getElementById('export-setup-btn');
    const importSetupFile = document.getElementById('import-setup-file');

    let currentBlockData = null;

    // ── HILFE-MODAL ───────────────────────────────────────────
    const helpModal    = document.getElementById('help-modal');
    const helpBtn      = document.getElementById('help-btn');
    const helpCloseBtn = document.getElementById('help-modal-close');

    const openHelp  = () => { if (helpModal) helpModal.classList.add('open'); };
    const closeHelp = () => { if (helpModal) helpModal.classList.remove('open'); };

    if (helpBtn)      helpBtn.addEventListener('click', openHelp);
    if (helpCloseBtn) helpCloseBtn.addEventListener('click', closeHelp);
    if (helpModal)    helpModal.addEventListener('click', e => { if (e.target === helpModal) closeHelp(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && helpModal?.classList.contains('open')) closeHelp(); });

    const searchInput = document.getElementById('fund-search-input');
    const searchResults = document.getElementById('fund-search-results');

    // ── SEARCH FUNCTIONALITY ─────────────────────────────────
    if (searchInput && searchResults) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            searchResults.innerHTML = '';
            
            if (query.length < 2) {
                searchResults.style.display = 'none';
                return;
            }

            let matches = [];
            managementBlocks.forEach(block => {
                block.funds.forEach(fund => {
                    const searchStr = `${fund.name} ${fund.info} ${fund.type}`.toLowerCase();
                    if (searchStr.includes(query)) {
                        matches.push({ fund, block });
                    }
                });
            });

            if (matches.length === 0) {
                searchResults.innerHTML = '<li><span class="fund-search-meta">Keine Fonds gefunden.</span></li>';
                searchResults.style.display = 'block';
                return;
            }

            matches.forEach(match => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span class="fund-search-name">${match.fund.name}</span>
                    <span class="fund-search-meta">${match.fund.info} | Schicht: ${match.block.title}</span>
                `;
                li.addEventListener('click', () => {
                    searchInput.value = '';
                    searchResults.style.display = 'none';
                    
                    document.querySelectorAll('.timeline-btn').forEach(b => b.classList.remove('active'));
                    updateDetails(null);
                    
                    document.querySelectorAll('.tower-layer').forEach(el => {
                        el.classList.remove('highlighted', 'exact-match');
                        const b = el.querySelector('.exact-match-badge'); 
                        if (b) b.remove();
                    });
                    
                    const targetBlockEl = document.getElementById(match.block.id);
                    if (targetBlockEl) {
                        document.querySelectorAll('.tower-layer').forEach(el => el.classList.add('highlighted'));
                        targetBlockEl.classList.add('exact-match');
                        const bgColor = window.getComputedStyle(targetBlockEl).backgroundColor;
                        targetBlockEl.style.setProperty('--badge-color', bgColor);
                        const badge = document.createElement('div');
                        badge.className = 'exact-match-badge';
                        badge.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Gefundener Fonds`;
                        targetBlockEl.insertBefore(badge, targetBlockEl.firstChild);
                        
                        targetBlockEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        setTimeout(() => targetBlockEl.click(), 500);
                    }
                });
                searchResults.appendChild(li);
            });
            searchResults.style.display = 'block';
        });

        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.style.display = 'none';
            }
        });
    }

    // ── FORMATTERS ──────────────────────────────────────────
    const formatCurrency = a => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(a);
    const formatNumberInput = a => a === 0 ? '' : new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(a);
    const parseEuro = s => { if (!s) return 0; const p = parseFloat(s.toString().replace(/\./g, '').replace(',', '.')); return isNaN(p) ? 0 : p; };

    // ── FINANCE OVERVIEW (V4.2) ─────────────────────────────
    const updateFinancialOverview = () => {
        let totalDistributedEinmal = 0;
        let totalDistributedSparrate = 0;
        const layerTotalsEinmal = {};
        const layerTotalsSparrate = {};

        managementBlocks.forEach(block => {
            let be = 0;
            let bs = 0;
            block.funds.forEach(f => {
                const key = `${block.id}::${f.name}`;
                be += portfolioGlobals.fundInvestments[key] || 0;
                bs += portfolioGlobals.fundSparrates[key] || 0;
            });
            // Empfehlungsliste-Beträge: separat für Breakdown-Anzeige, aber NICHT
            // in layerTotalsEinmal (Allokations-%) und NICHT in totalDistributedEinmal
            const eKey = `${block.id}::empfehlungsliste`;
            const eInv  = portfolioGlobals.fundInvestments[eKey] || 0;
            const eSpar = portfolioGlobals.fundSparrates[eKey]   || 0;
            if (be > 0) layerTotalsEinmal[block.id]   = be;
            if (bs > 0) layerTotalsSparrate[block.id] = bs;
            // Empfehlungsliste im Breakdown gesondert merken
            if (eInv  > 0) layerTotalsEinmal[block.id]   = (layerTotalsEinmal[block.id]   || 0) + eInv;
            if (eSpar > 0) layerTotalsSparrate[block.id] = (layerTotalsSparrate[block.id] || 0) + eSpar;
            // Für Allokations-% und Verplant-Anzeige nur echte Fonds
            totalDistributedEinmal   += be;
            totalDistributedSparrate += bs;
        });

        const remainingEinmal = portfolioGlobals.totalInvestment - totalDistributedEinmal;
        const remainingSparrate = portfolioGlobals.totalSparrate - totalDistributedSparrate;

        if (totalDistributedDisplay) totalDistributedDisplay.textContent = formatCurrency(totalDistributedEinmal);
        if (totalRemainingDisplay) {
            totalRemainingDisplay.textContent = formatCurrency(remainingEinmal);
            const row = totalRemainingDisplay.closest('.finance-row');
            if (row) row.classList.toggle('negative-balance', remainingEinmal < 0);
        }

        if (sparrateDistributedDisplay) sparrateDistributedDisplay.textContent = formatCurrency(totalDistributedSparrate);
        if (sparrateRemainingDisplay) {
            sparrateRemainingDisplay.textContent = formatCurrency(remainingSparrate);
            const row = sparrateRemainingDisplay.closest('.finance-row');
            if (row) row.classList.toggle('negative-balance', remainingSparrate < 0);
        }

        if (layerBreakdownList) {
            layerBreakdownList.innerHTML = '';
            document.querySelectorAll('.layer-assigned-amount,.layer-assigned-amount-right').forEach(b => { b.classList.remove('visible'); b.textContent = ''; });
            // Reihenfolge: von unten nach oben wie im Turm
            const TOWER_ORDER = ['block-tagesgeld','block-kasse','block-defensiv','block-ausgewogen','block-dynamisch','block-maerkte','block-spezial'];
            const ids = Array.from(new Set([...Object.keys(layerTotalsEinmal), ...Object.keys(layerTotalsSparrate)]))
                .sort((a, b) => {
                    const ia = TOWER_ORDER.indexOf(a);
                    const ib = TOWER_ORDER.indexOf(b);
                    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
                });

            if (ids.length === 0) {
                layerBreakdownList.innerHTML = '<li class="empty-breakdown">Noch keine Beträge zugewiesen</li>';
            } else {
                // Gesamtsumme für Prozentberechnung
                const grandTotalEinmal = Object.values(layerTotalsEinmal).reduce((s, v) => s + v, 0);
                ids.forEach(blockId => {
                    const block = managementBlocks.find(b => b.id === blockId);
                    if (!block) return;
                    const amountEinmal = layerTotalsEinmal[blockId] || 0;
                    const amountSpar = layerTotalsSparrate[blockId] || 0;
                    const color = layerColors[blockId] || '#BEB6AA';
                    const li = document.createElement('li');

                    let breakdownStr = '';
                    if (amountEinmal > 0) breakdownStr += formatCurrency(amountEinmal);
                    if (amountSpar > 0) breakdownStr += (breakdownStr ? ' + ' : '') + `${formatCurrency(amountSpar)} mtl.`;

                    // Prozentualer Anteil am Gesamteinmalbetrag
                    let pctHtml = '';
                    if (grandTotalEinmal > 0 && amountEinmal > 0) {
                        const pct = (amountEinmal / grandTotalEinmal) * 100;
                        pctHtml = `<span class="breakdown-pct">${pct.toFixed(1).replace('.', ',')}%</span>`;
                    }

                    li.innerHTML = `<span class="breakdown-layer-name"><span class="layer-color-dot" style="background:${color}"></span>${block.title}</span><span class="breakdown-amount">${pctHtml}${breakdownStr}</span>`;
                    layerBreakdownList.appendChild(li);

                    const layerEl = document.getElementById(blockId);
                    if (layerEl) {
                        const cls = blockId === 'block-tagesgeld' ? 'layer-assigned-amount-right' : 'layer-assigned-amount';
                        let badge = layerEl.querySelector(`.${cls}`);
                        if (!badge) { badge = document.createElement('div'); badge.className = cls; layerEl.appendChild(badge); }
                        badge.textContent = breakdownStr;
                        badge.classList.add('visible');
                    }
                });
            }
        }

        if (savePortfolioBtn) {
            const hasFunds = portfolio.length > 0;
            savePortfolioBtn.toggleAttribute('disabled', !hasFunds);
            hasFunds
                ? savePortfolioBtn.setAttribute('title', 'Gewählte Liste als PDF herunterladen')
                : savePortfolioBtn.setAttribute('title', 'Bitte wählen Sie zuerst mindestens einen Fonds aus.');
        }

        // Portfolio-Info-Bar ein-/ausblenden
        const infoBar = document.getElementById('portfolio-info-bar');
        if (infoBar) {
            const hasData = portfolio.length > 0;
            infoBar.style.display = hasData ? 'grid' : 'none';
        }

        if (portfolio.length > 0) {
            if (portfolioGlobals.totalInvestment > 0) {
                // Allokations-% nur aus echten Fonds (ohne Empfehlungsliste) berechnen
                let allocations = portfolio.map(layer => {
                    let realFundTotal = 0;
                    layer.funds.forEach(f => {
                        if (f._isEmpfehlungsliste) return;
                        const key = `${layer.blockId}::${f.name}`;
                        realFundTotal += portfolioGlobals.fundInvestments[key] || 0;
                    });
                    return { layer, val: (realFundTotal / portfolioGlobals.totalInvestment) * 100 };
                });
                let sumInt = 0;
                allocations.forEach(a => {
                    a.floor = Math.floor(a.val * 10);
                    a.remainder = (a.val * 10) - a.floor;
                    sumInt += a.floor;
                });
                let diff = 1000 - sumInt; // 100.0% * 10
                allocations.sort((a, b) => b.remainder - a.remainder);
                for (let i = 0; i < diff && i < allocations.length; i++) {
                    allocations[i].floor += 1;
                }
                allocations.forEach(a => {
                    a.layer.allocation = (a.floor / 10).toFixed(1);
                });
            } else {
                portfolio.forEach(layer => layer.allocation = "0.0");
            }
            savePortfolio();
        }
    };

    // Hilfsfunktion: Debounce für Input-Events (verhindert zu häufige Neuberechnungen)
    const debounce = (fn, delay) => {
        let timer;
        return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
    };

    if (totalInvestmentInput) {
        totalInvestmentInput.value = portfolioGlobals.totalInvestment > 0 ? formatNumberInput(portfolioGlobals.totalInvestment) : '';
        const applyTotalInvestment = (rawVal) => {
            const v = parseEuro(rawVal);
            portfolioGlobals.totalInvestment = v > 0 ? v : 0;
            saveGlobals();
            updateFinancialOverview(); renderPanel();
        };
        totalInvestmentInput.addEventListener('blur', e => {
            const v = parseEuro(e.target.value);
            e.target.value = v > 0 ? formatNumberInput(v) : '';
            applyTotalInvestment(e.target.value);
        });
        totalInvestmentInput.addEventListener('input', debounce(e => applyTotalInvestment(e.target.value), 400));
        totalInvestmentInput.addEventListener('change', e => applyTotalInvestment(e.target.value));
        totalInvestmentInput.addEventListener('focus', e => {
            e.target.value = portfolioGlobals.totalInvestment > 0 ? portfolioGlobals.totalInvestment.toString().replace('.', ',') : '';
        });
        totalInvestmentInput.addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
    }

    if (totalInvestmentSparrate) {
        totalInvestmentSparrate.value = portfolioGlobals.totalSparrate > 0 ? formatNumberInput(portfolioGlobals.totalSparrate) : '';
        const applyTotalSparrate = (rawVal) => {
            const v = parseEuro(rawVal);
            portfolioGlobals.totalSparrate = v > 0 ? v : 0;
            saveGlobals();
            updateFinancialOverview(); renderPanel();
        };
        totalInvestmentSparrate.addEventListener('blur', e => {
            const v = parseEuro(e.target.value);
            e.target.value = v > 0 ? formatNumberInput(v) : '';
            applyTotalSparrate(e.target.value);
        });
        totalInvestmentSparrate.addEventListener('input', debounce(e => applyTotalSparrate(e.target.value), 400));
        totalInvestmentSparrate.addEventListener('change', e => applyTotalSparrate(e.target.value));
        totalInvestmentSparrate.addEventListener('focus', e => {
            e.target.value = portfolioGlobals.totalSparrate > 0 ? portfolioGlobals.totalSparrate.toString().replace('.', ',') : '';
        });
        totalInvestmentSparrate.addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
    }

    // ── PORTFOLIO PANEL RENDERING ───────────────────────────
    const updateAllocBar = () => {
        let total = 0;
        document.querySelectorAll('.layer-alloc-input').forEach(inp => { total += Number(inp.value) || 0; });
        allocTotal.textContent = total.toFixed(1);
        allocBarFill.style.width = Math.min(total, 100) + '%';
        allocBarFill.classList.toggle('over-hundred', total > 100);
        allocTotal.classList.toggle('over-hundred', total > 100);
    };

    const updateTowerBadges = () => {
        managementBlocks.forEach(block => {
            const layer = portfolio.find(l => l.blockId === block.id);
            const count = layer ? layer.funds.length : 0;
            const badge = document.querySelector(`#${block.id} .layer-selection-count`);
            if (!badge) return;
            badge.classList.toggle('visible', count > 0);
            if (count > 0) badge.textContent = `✓ ${count} ausgewählt`;
        });
    };

    const renderPanel = () => {
        panelLayers.innerHTML = '';
        if (portfolio.length === 0) {
            panelEmpty.style.display = 'flex';
            panelLayers.style.display = 'none';
            updateAllocBar();
            updateTowerBadges();
            return;
        }
        panelEmpty.style.display = 'none';
        panelLayers.style.display = 'block';

        portfolio.forEach(layer => {
            const color = layerColors[layer.blockId] || '#BEB6AA';
            const layerEl = document.createElement('div');
            layerEl.className = 'panel-layer';

            // Calculate EUR total for this layer
            let layerEurTotal = 0;
            let layerSparTotal = 0;
            layer.funds.forEach(f => {
                const key = `${layer.blockId}::${f.name}`;
                layerEurTotal += portfolioGlobals.fundInvestments[key] || 0;
                layerSparTotal += portfolioGlobals.fundSparrates[key] || 0;
            });
            let eurHint = '';
            if (layerEurTotal > 0 || layerSparTotal > 0) {
                let amountsStr = '';
                if (layerEurTotal > 0) amountsStr += `<span>${formatCurrency(layerEurTotal)}</span>`;
                if (layerSparTotal > 0) amountsStr += `<span>+ ${formatCurrency(layerSparTotal)} mtl.</span>`;
                eurHint = `<div class="layer-alloc-eur">${amountsStr}</div>`;
            }

            const header = document.createElement('div');
            header.className = 'panel-layer-header';
            header.innerHTML = `
                <div class="layer-panel-dot" style="background:${color}"></div>
                <span class="layer-name">${layer.blockTitle}</span>
                <div class="layer-alloc-wrap">
                    <input class="layer-alloc-input" type="number" readonly
                        value="${layer.allocation}" data-block-id="${layer.blockId}"
                        title="Automatisch berechnet aus den eingegebenen Beträgen">
                    <span class="layer-alloc-pct">%${eurHint}</span>
                </div>`;
            layerEl.appendChild(header);

            layer.funds.forEach(fund => {
                if (fund._isEmpfehlungsliste) return; // wird separat gerendert
                const key = `${layer.blockId}::${fund.name}`;
                const inv = portfolioGlobals.fundInvestments[key] || 0;
                const spar = portfolioGlobals.fundSparrates[key] || 0;
                
                let amountsStr = '';
                if (inv > 0) amountsStr += `${formatCurrency(inv)}`;
                if (spar > 0) amountsStr += (amountsStr ? ' + ' : '') + `${formatCurrency(spar)} mtl.`;
                
                const ertragTxt = fund.ertrag ? ` · ${fund.ertrag}` : '';
                const amountsTxt = amountsStr ? ` · <strong style="color:var(--color-mlp-blau);">${amountsStr}</strong>` : '';

                const item = document.createElement('div');
                item.className = 'panel-fund-item';
                item.innerHTML = `
                    <div class="panel-fund-info">
                        <div class="panel-fund-name" title="${fund.name}">${fund.name}</div>
                        <div class="panel-fund-meta">${fund.info}${ertragTxt}${amountsTxt}</div>
                    </div>
                    <button class="panel-fund-remove" title="Entfernen"
                        data-block="${layer.blockId}" data-fund="${fund.name}">✕</button>`;
                layerEl.appendChild(item);
            });

            // ── "Von Empfehlungsliste genommen" Sonderfeld ───────
            (() => {
                const eKey  = `${layer.blockId}::empfehlungsliste`;
                const eInv  = portfolioGlobals.fundInvestments[eKey] || 0;
                const eSpar = portfolioGlobals.fundSparrates[eKey]   || 0;

                // Änderung 1: Nur anzeigen wenn mindestens ein Betrag eingegeben ist
                if (eInv === 0 && eSpar === 0) return;

                const eRow = document.createElement('div');
                eRow.className = 'panel-fund-item panel-empfehlung-row';

                const eInvFmt  = eInv  > 0 ? formatNumberInput(eInv)  : '';
                const eSparFmt = eSpar > 0 ? formatNumberInput(eSpar) : '';

                // Änderung 2: Lade die gespeicherten Empfehlungsliste-Fonds für das Popup
                let empFondsForBlock = [];
                try {
                    const allEmpFonds = JSON.parse(localStorage.getItem('empfehlungslisteFonds_V44') || '{}');
                    empFondsForBlock = allEmpFonds[layer.blockId] || [];
                } catch { empFondsForBlock = []; }

                let popupHtml = '';
                if (empFondsForBlock.length > 0) {
                    const popupItems = empFondsForBlock.map(u =>
                        `<span><b>${u.name}</b> · WKN ${u.wkn} · ${u.schwerpunkt||'?'} · ${formatCurrency(u.einmal||0)}${u.sparrate > 0 ? ' + '+formatCurrency(u.sparrate)+' mtl.' : ''}</span>`
                    ).join('');
                    popupHtml = `<div class="empfehlung-popup">${popupItems}</div>`;
                }

                eRow.innerHTML = `
                    <div class="panel-fund-info">
                        <div class="panel-fund-name empfehlung-label empfehlung-label-hoverable" title="Fonds, die nicht mehr auf der VEM-Empfehlungsliste stehen" style="position:relative;cursor:${empFondsForBlock.length > 0 ? 'help' : 'default'};">
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5" style="vertical-align:-2px;margin-right:4px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                            Von Empfehlungsliste genommen
                            ${popupHtml}
                        </div>
                        <div class="panel-fund-meta" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px;">
                            <input class="fund-investment-input empfehlung-input" type="text" inputmode="decimal"
                                placeholder="Einmalbetrag" title="Einmalbetrag"
                                data-ekey="${eKey}" data-spar="0"
                                value="${eInvFmt}" style="width:110px;">
                            <input class="fund-investment-input empfehlung-input" type="text" inputmode="decimal"
                                placeholder="Sparrate mtl." title="Sparrate monatlich"
                                data-ekey="${eKey}" data-spar="1"
                                value="${eSparFmt}" style="width:110px;">
                        </div>
                    </div>`;
                layerEl.appendChild(eRow);

                // Input-Listener für Empfehlungsliste-Felder
                eRow.querySelectorAll('.empfehlung-input').forEach(inp => {
                    inp.addEventListener('blur', () => {
                        const v = parseEuro(inp.value);
                        inp.value = v > 0 ? formatNumberInput(v) : '';
                        if (inp.dataset.spar === '0') portfolioGlobals.fundInvestments[eKey] = v;
                        else                          portfolioGlobals.fundSparrates[eKey]   = v;
                        saveGlobals(); updateFinancialOverview(); renderPanel();
                    });
                    inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
                });
            })();

            // ── "Fonds delistet" Icon (ambiguous unmatched) ──────
            (() => {
                let delistedAll;
                try { delistedAll = JSON.parse(localStorage.getItem('delistedFunds_V44') || '[]'); } catch { delistedAll = []; }
                // Filtere nach Fonds ohne klare Schicht-Zuordnung (werden global angezeigt, nicht per Schicht)
                // Zeige Icon nur in der ersten Schicht (block-kasse) um Duplizierung zu vermeiden
                if (layer.blockId !== 'block-kasse' || delistedAll.length === 0) return;

                const total = delistedAll.reduce((s, u) => s + (u.einmal || 0), 0);
                const tooltipHtml = delistedAll.map(u =>
                    `${u.name} · WKN: ${u.wkn} · ${u.schwerpunkt||'?'} · ${formatCurrency(u.einmal||0)}`
                ).join('&#10;');

                const badge = document.createElement('div');
                badge.className = 'delisted-badge-row';
                badge.innerHTML = `
                    <div class="delisted-badge" title="${tooltipHtml}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:-2px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        Fonds delistet: <strong>${delistedAll.length}</strong> · ${formatCurrency(total)}
                        <span class="delisted-badge-hover">${delistedAll.map(u =>
                            `<span><b>${u.name}</b> · WKN ${u.wkn} · ${u.schwerpunkt||'?'} · ${formatCurrency(u.einmal||0)}${u.sparrate > 0 ? ' + '+formatCurrency(u.sparrate)+' mtl.' : ''}</span>`
                        ).join('')}</span>
                    </div>`;
                layerEl.appendChild(badge);
            })();

            panelLayers.appendChild(layerEl);
        });

        panelLayers.querySelectorAll('.panel-fund-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                removeFund(btn.dataset.block, btn.dataset.fund);
                updateFinancialOverview();
                renderPanel();
                if (currentBlockData && currentBlockData.id === btn.dataset.block) {
                    renderFundList(currentBlockData.funds);
                    refreshModalButtons();
                }
            });
        });

        updateAllocBar();
        updateTowerBadges();
        updatePortfolioCountrySummary();
    };

    // ── V4.3.3.7: Gemeinsame Fonds-Klassifizierungs-Hilfsfunktion ──
    // Bestimmt anhand fund.type ob Aktien, Anleihen oder Gemischt
    const classifyFund = (fundType) => {
        if (!fundType) return 'mixed';
        const t = fundType.toLowerCase();
        const isAnleihen = t.includes('anleihen') || t.includes('renten') || t.includes('geldmarkt') || t.includes('bond');
        const isAktien   = (t.includes('aktien') || t.includes('rohstoffe') || t.includes('edelmetalle')) && !t.includes('anleihen');
        if (isAktien   && !isAnleihen) return 'aktien';
        if (isAnleihen && !isAktien)   return 'anleihen';
        return 'mixed';
    };

    const updatePortfolioCountrySummary = () => {
        const summaryContainer = document.getElementById('portfolio-country-summary');
        const clusterListEl = document.getElementById('portfolio-cluster-list');
        if (!summaryContainer || !clusterListEl) return;

        // ── Cluster-Definitionen ─────────────────────────────────────
        // 6-Regionen-Logik (V4.3.3.6+)
        const CLUSTER_DEFS = {
            'Nordamerika': {
                label: 'Nordamerika', color: '#1e40af',
                countries: new Set(['USA','Vereinigte Staaten','Kanada','Nordamerika'])
            },
            'Europa': {
                label: 'Europa', color: '#047857',
                countries: new Set(['Deutschland','Frankreich','Grossbritannien','Niederlande','Oesterreich','Belgien','Schweiz','Schweden','Norwegen','Daenemark','Finnland','Spanien','Italien','Portugal','Europa','Polen','Tschechien','Ungarn','Rumaenien','Griechenland','Litauen','Lettland','Estland','Bulgarien',
                                    'Großbritannien','Österreich','Dänemark','Rumänien'])
            },
            'Schwellenlaender': {
                label: 'Schwellenl\u00e4nder', color: '#7c3aed',
                countries: new Set(['China','Volksrepublik China','Indien','Brasilien','Mexiko','Argentinien','Chile','Kolumbien','Peru','Tuerkei','Suedafrika','Nigeria','Aegypten','Israel','Kasachstan','Namibia','Mauritius','Kuwait','Pakistan','Schwellenlaender','Emerging Markets',
                                    'T\u00fcrkei','S\u00fcdafrika','\u00c4gypten','Schwellenl\u00e4nder'])
            },
            'Pacific': {
                label: 'Pacific', color: '#0e7490',
                countries: new Set(['Japan','Australien','Neuseeland','Hongkong','Singapur','Taiwan','Suedkorea','Korea','Thailand','Vietnam','Philippinen','Indonesien','Malaysia','Pacific','S\u00fcdkorea'])
            },
            'Sonstige ETF': {
                label: 'Sonstige ETF', color: '#64748b',
                countries: new Set(['Irland','Luxemburg'])
            },
            'Sonstige': {
                label: 'Sonstige', color: '#94a3b8',
                countries: new Set(['global','Global','sonstige','Sonstige','Sonstige Laender','Frontiers Markets','Frontier Markets','Asien','Sonstige L\u00e4nder'])
            }
        };
        const CLUSTER_ORDER = ['Nordamerika','Europa','Schwellenlaender','Pacific','Sonstige ETF','Sonstige'];
        // Label-Map for display
        const CLUSTER_LABELS = {
            'Nordamerika': 'Nordamerika',
            'Europa': 'Europa',
            'Schwellenlaender': 'Schwellenl\u00e4nder',
            'Pacific': 'Pacific',
            'Sonstige ETF': 'Sonstige ETF',
            'Sonstige': 'Sonstige'
        };

        // ── Aggregation pro Land (gesamt, Aktien, Anleihen) ──────────
        let countryValues         = {};
        let countryValuesAktien   = {};
        let countryValuesAnleihen = {};

        portfolio.forEach(layer => {
            layer.funds.forEach(fund => {
                const key = `${layer.blockId}::${fund.name}`;
                const inv = portfolioGlobals.fundInvestments[key] || 0;
                if (inv > 0) {
                    const blockData = managementBlocks.find(b => b.id === layer.blockId);
                    if (blockData) {
                        const fundData = blockData.funds.find(f => f.name === fund.name);
                        if (fundData && fundData.countryWeightings) {
                            const fundClass = classifyFund(fundData.type);
                            fundData.countryWeightings.forEach(cw => {
                                const v = inv * (cw.weight / 100);
                                const c = cw.country;
                                if (!countryValues[c]) countryValues[c] = 0;
                                countryValues[c] += v;
                                if (fundClass === 'aktien') {
                                    if (!countryValuesAktien[c]) countryValuesAktien[c] = 0;
                                    countryValuesAktien[c] += v;
                                } else if (fundClass === 'anleihen') {
                                    if (!countryValuesAnleihen[c]) countryValuesAnleihen[c] = 0;
                                    countryValuesAnleihen[c] += v;
                                }
                            });
                        }
                    }
                }
            });
        });

        if (portfolioGlobals.totalInvestment <= 0 || Object.keys(countryValues).length === 0) {
            summaryContainer.style.display = 'none';
            return;
        }
        summaryContainer.style.display = 'block';

        // ── Cluster-Zuordnung ─────────────────────────────────────────
        const clusterValues          = {};
        const clusterDetails         = {};
        const clusterDetailsAktien   = {};
        const clusterDetailsAnleihen = {};
        CLUSTER_ORDER.forEach(k => {
            clusterValues[k]          = 0;
            clusterDetails[k]         = {};
            clusterDetailsAktien[k]   = {};
            clusterDetailsAnleihen[k] = {};
        });

        const assignCountry = (country, valTotal, valAktien, valAnleihen) => {
            const trimmed = country.trim();
            let assigned = false;
            for (const key of CLUSTER_ORDER) {
                if (CLUSTER_DEFS[key].countries.has(trimmed)) {
                    clusterValues[key]                      += valTotal;
                    clusterDetails[key][country]             = (clusterDetails[key][country]         || 0) + valTotal;
                    clusterDetailsAktien[key][country]       = (clusterDetailsAktien[key][country]   || 0) + valAktien;
                    clusterDetailsAnleihen[key][country]     = (clusterDetailsAnleihen[key][country] || 0) + valAnleihen;
                    assigned = true;
                    break;
                }
            }
            if (!assigned) {
                clusterValues['Sonstige']                    += valTotal;
                clusterDetails['Sonstige'][country]           = (clusterDetails['Sonstige'][country]         || 0) + valTotal;
                clusterDetailsAktien['Sonstige'][country]     = (clusterDetailsAktien['Sonstige'][country]   || 0) + valAktien;
                clusterDetailsAnleihen['Sonstige'][country]   = (clusterDetailsAnleihen['Sonstige'][country] || 0) + valAnleihen;
            }
        };

        Object.keys(countryValues).forEach(country => {
            assignCountry(
                country,
                countryValues[country]         || 0,
                countryValuesAktien[country]   || 0,
                countryValuesAnleihen[country] || 0
            );
        });

        // ── Normalisierung auf 100% ──────────────────────────────────
        const assignedTotal = Object.values(clusterValues).reduce((s, v) => s + v, 0);
        if (assignedTotal <= 0) { summaryContainer.style.display = 'none'; return; }

        // ── Render Cluster Pills ──────────────────────────────────────
        clusterListEl.innerHTML = '';
        const fmt = n => n.toFixed(1).replace('.', ',') + '%';

        CLUSTER_ORDER.forEach(clusterKey => {
            const cluster = CLUSTER_DEFS[clusterKey];
            const clusterLabel = CLUSTER_LABELS[clusterKey];
            const pct = (clusterValues[clusterKey] / assignedTotal) * 100;
            if (pct < 0.05) return;

            // Aktien- und Anleihen-Anteil des Clusters
            const clusterAktienTotal   = Object.values(clusterDetailsAktien[clusterKey]).reduce((s,v) => s+v, 0);
            const clusterAnleihenTotal = Object.values(clusterDetailsAnleihen[clusterKey]).reduce((s,v) => s+v, 0);
            const clusterAktienPct     = (clusterAktienTotal   / assignedTotal) * 100;
            const clusterAnleihenPct   = (clusterAnleihenTotal / assignedTotal) * 100;

            // Unterzeile im Pill (nur wenn Aktien oder Anleihen > 0)
            let clusterSubHtml = '';
            const subParts = [];
            if (clusterAktienPct   > 0.05) subParts.push(`<span style="color:#60a5fa;font-size:0.7em;white-space:nowrap;">Aktien ${fmt(clusterAktienPct)}</span>`);
            if (clusterAnleihenPct > 0.05) subParts.push(`<span style="color:#86efac;font-size:0.7em;white-space:nowrap;">Anleihen ${fmt(clusterAnleihenPct)}</span>`);
            if (subParts.length > 0) {
                clusterSubHtml = `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:2px;">${subParts.join('')}</div>`;
            }

            // Top-5 Laender sortiert nach Gesamtanteil
            const top5 = Object.entries(clusterDetails[clusterKey])
                .map(([c, v]) => ({
                    c,
                    p:         (v / assignedTotal) * 100,
                    pAktien:   ((clusterDetailsAktien[clusterKey][c]   || 0) / assignedTotal) * 100,
                    pAnleihen: ((clusterDetailsAnleihen[clusterKey][c] || 0) / assignedTotal) * 100
                }))
                .sort((a, b) => b.p - a.p).slice(0, 7);

            const top5Html = top5.map(d => {
                const hasAkt = d.pAktien   > 0.01;
                const hasAnl = d.pAnleihen > 0.01;
                let subLine = '';
                if (hasAkt || hasAnl) {
                    const parts = [];
                    if (hasAkt) parts.push(`<span style="color:#60a5fa">Aktien\u00a0${fmt(d.pAktien)}</span>`);
                    if (hasAnl) parts.push(`<span style="color:#86efac">Anleihen\u00a0${fmt(d.pAnleihen)}</span>`);
                    subLine = `<div style="font-size:0.78em;color:rgba(255,255,255,0.5);padding-left:6px;margin-top:1px;">${parts.join(' \u00b7 ')}</div>`;
                }
                return `<li style="margin-bottom:6px;"><div style="display:flex;justify-content:space-between;gap:12px;"><span>${d.c}</span><strong>${fmt(d.p)}</strong></div>${subLine}</li>`;
            }).join('');

            const pill = document.createElement('div');
            pill.className = 'cluster-pill';
            pill.innerHTML = `
                <div class="cluster-pill-inner">
                    <div class="cluster-color-bar" style="background:${cluster.color};"></div>
                    <div style="flex:1;min-width:0;">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <span class="cluster-label">${clusterLabel}</span>
                            <span class="cluster-pct" style="color:${cluster.color};">${pct.toFixed(1).replace('.', ',')}%</span>
                        </div>
                        ${clusterSubHtml}
                    </div>
                </div>
                <div class="cluster-popup">
                    <div style="font-size:0.82em;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.2);padding-bottom:5px;margin-bottom:7px;color:${cluster.color}">${clusterLabel} \u2013 ${pct.toFixed(1).replace('.', ',')}%</div>
                    <ul style="margin:0;padding:0;list-style:none;font-size:0.82em;">${top5Html}</ul>
                </div>`;
            clusterListEl.appendChild(pill);
        });

        summaryContainer.style.display = 'block';
    };



    // ── MODAL ────────────────────────────────────────────────
    const refreshModalButtons = () => {
        if (!currentBlockData) return;
        modalList.querySelectorAll('.fund-list-item').forEach(li => {
            const sel = isFundSelected(currentBlockData.id, li.dataset.fundName);
            const btn = li.querySelector('.btn-fund-select');
            if (!btn) return;
            li.classList.toggle('is-selected', sel);
            btn.classList.toggle('selected', sel);
            btn.textContent = sel ? '✓ Ausgewählt' : '+ Auswählen';
        });
    };

    const renderFundList = funds => {
        modalList.innerHTML = '';
        if (!funds || funds.length === 0) {
            modalList.innerHTML = '<li class="fund-list-item"><span class="fund-name">Keine Fonds für diesen Filter.</span></li>';
            return;
        }
        funds.forEach(fund => {
            const sel = isFundSelected(currentBlockData.id, fund.name);
            const ertragCls = fund.ertrag === 'thesaurierend' ? 'thesaurierend' : fund.ertrag === 'ausschüttend' ? 'ausschuettend' : '';
            const ertragHtml = fund.ertrag ? `<span class="fund-badge-ertrag ${ertragCls}">${fund.ertrag}</span>` : '';
            const key = `${currentBlockData.id}::${fund.name}`;
            
            // V4.3.3.7: Tooltip Ländergewichtung mit Aktien/Anleihen-Aufschlüsselung
            let countryTooltipHtml = '';
            if (fund.countryWeightings && fund.countryWeightings.length > 0) {
                // Fonds-Klasse bestimmen (Aktien / Anleihen / gemischt)
                const fundClass = classifyFund(fund.type);
                const listHtml = fund.countryWeightings.map(c => {
                    let subLine = '';
                    if (fundClass === 'aktien') {
                        subLine = `<div style="font-size:0.8em;color:#93c5fd;padding-left:4px;">&#x2514; Aktien ${c.weight.toFixed ? c.weight.toFixed(1).replace('.',',') : c.weight}%</div>`;
                    } else if (fundClass === 'anleihen') {
                        subLine = `<div style="font-size:0.8em;color:#86efac;padding-left:4px;">&#x2514; Anleihen ${c.weight.toFixed ? c.weight.toFixed(1).replace('.',',') : c.weight}%</div>`;
                    }
                    return `<li style="margin-bottom:5px;"><div style="display:flex;justify-content:space-between;gap:10px;"><span>${c.country}</span><strong>${c.weight}%</strong></div>${subLine}</li>`;
                }).join('');

                // Kopfzeile mit Fondsklassen-Badge
                const classLabel = fundClass === 'aktien' ? '<span style="font-size:0.75em;background:#1e3a8a;color:#93c5fd;border-radius:4px;padding:1px 6px;margin-left:6px;">Aktien</span>'
                                 : fundClass === 'anleihen' ? '<span style="font-size:0.75em;background:#14532d;color:#86efac;border-radius:4px;padding:1px 6px;margin-left:6px;">Anleihen</span>'
                                 : '<span style="font-size:0.75em;background:#334155;color:#cbd5e1;border-radius:4px;padding:1px 6px;margin-left:6px;">Gemischt</span>';

                countryTooltipHtml = `
                    <div class="fund-country-tooltip">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="country-icon">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="2" y1="12" x2="22" y2="12"></line>
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                        </svg>
                        <div class="tooltip-content">
                            <strong style="font-size:1.05em; border-bottom:1px solid #555; display:flex; align-items:center; padding-bottom:5px; margin-bottom:5px;">Top 5 Länder ${classLabel}</strong>
                            <ul style="margin:0;padding:0;list-style:none;">${listHtml}</ul>
                        </div>
                    </div>`;
            }

            const fundInput = `
                <div class="fund-input-wrapper">
                    <div class="fund-input-col">
                        <label class="fund-input-label">Einmalbeitrag</label>
                        <div class="currency-input-wrapper">
                            <input type="text" class="fund-investment-input" data-fund-key="${key}"
                                placeholder="0,00" inputmode="decimal"
                                value="${portfolioGlobals.fundInvestments[key] ? formatNumberInput(portfolioGlobals.fundInvestments[key]) : ''}">
                            <span class="currency-symbol">€</span>
                        </div>
                    </div>
                    <div class="fund-input-col">
                        <label class="fund-input-label">Sparrate mtl.</label>
                        <div class="currency-input-wrapper">
                            <input type="text" class="fund-sparrate-input" data-fund-key="${key}"
                                placeholder="0,00" inputmode="decimal"
                                value="${portfolioGlobals.fundSparrates[key] ? formatNumberInput(portfolioGlobals.fundSparrates[key]) : ''}">
                            <span class="currency-symbol">€</span>
                        </div>
                    </div>
                </div>`;

            const li = document.createElement('li');
            const isDelistet = !!fund._isDelistet;
            li.className = `fund-list-item${sel ? ' is-selected' : ''}${isDelistet ? ' fund-delistet' : ''}`;
            li.dataset.fundName = fund.name;

            const delistetBadgeHtml = isDelistet
                ? `<span class="fund-delistet-badge"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Delistet</span>`
                : '';

            li.innerHTML = `
                <div class="fund-info-wrapper">
                    <div class="fund-header" style="display:flex; align-items:center; gap:8px;">
                        <span class="fund-name">${fund.name}</span>
                        ${delistetBadgeHtml}
                        ${countryTooltipHtml}
                    </div>
                    <div style="margin-top:4px;display:flex;gap:8px;flex-wrap:wrap;">
                        ${!isDelistet ? `<span class="fund-badge">${fund.type}</span>` : ''}
                        ${ertragHtml}
                    </div>
                    <span class="fund-info" style="margin-top:6px;display:block;">${fund.info}</span>
                </div>
                ${fundInput}
                <button class="btn-fund-select${sel ? ' selected' : ''}"
                    title="${sel ? 'Klicken zum Entfernen' : 'Zum Portfolio hinzufügen'}">
                    ${sel ? '✓ Ausgewählt' : '+ Auswählen'}
                </button>`;


            // EUR Input events (V4.2)
            const inpEinmal = li.querySelector('.fund-investment-input');
            if (inpEinmal) {
                inpEinmal.addEventListener('input', e => {
                    const v = parseEuro(e.target.value);
                    if (v > 0) {
                        portfolioGlobals.fundInvestments[key] = v;
                        if (!isFundSelected(currentBlockData.id, fund.name)) {
                            addFund(currentBlockData, fund);
                            refreshModalButtons();
                        }
                    }
                    else { delete portfolioGlobals.fundInvestments[key]; }
                    saveGlobals();
                    updateFinancialOverview(); renderPanel();
                });
                inpEinmal.addEventListener('blur', e => {
                    const v = parseEuro(e.target.value);
                    if (v > 0) { e.target.value = formatNumberInput(v); }
                    else { e.target.value = ''; }
                });
                inpEinmal.addEventListener('focus', e => {
                    const v = portfolioGlobals.fundInvestments[key] || 0;
                    e.target.value = v > 0 ? v.toString().replace('.', ',') : '';
                });
                inpEinmal.addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
            }

            const inpSpar = li.querySelector('.fund-sparrate-input');
            if (inpSpar) {
                inpSpar.addEventListener('input', e => {
                    const v = parseEuro(e.target.value);
                    if (v > 0) {
                        portfolioGlobals.fundSparrates[key] = v;
                        if (!isFundSelected(currentBlockData.id, fund.name)) {
                            addFund(currentBlockData, fund);
                            refreshModalButtons();
                        }
                    }
                    else { delete portfolioGlobals.fundSparrates[key]; }
                    saveGlobals();
                    updateFinancialOverview(); renderPanel();
                });
                inpSpar.addEventListener('blur', e => {
                    const v = parseEuro(e.target.value);
                    if (v > 0) { e.target.value = formatNumberInput(v); }
                    else { e.target.value = ''; }
                });
                inpSpar.addEventListener('focus', e => {
                    const v = portfolioGlobals.fundSparrates[key] || 0;
                    e.target.value = v > 0 ? v.toString().replace('.', ',') : '';
                });
                inpSpar.addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
            }

            // Portfolio select toggle (V4.3)
            const selBtn = li.querySelector('.btn-fund-select');
            selBtn.addEventListener('click', e => {
                e.stopPropagation();
                if (isFundSelected(currentBlockData.id, fund.name)) removeFund(currentBlockData.id, fund.name);
                else addFund(currentBlockData, fund);
                renderPanel();
                refreshModalButtons();
            });

            modalList.appendChild(li);

            // ── Tooltip-Positionierung via JS (fixed, immer sichtbar) ──
            const tooltipWrapper = li.querySelector('.fund-country-tooltip');
            if (tooltipWrapper) {
                const tooltipContent = tooltipWrapper.querySelector('.tooltip-content');
                tooltipWrapper.addEventListener('mouseenter', () => {
                    const iconRect = tooltipWrapper.getBoundingClientRect();
                    const modalHeaderEl = document.querySelector('#funds-modal .modal-header');
                    const headerBottom = modalHeaderEl ? modalHeaderEl.getBoundingClientRect().bottom : 80;
                    const tooltipH = 160; // geschätzte Höhe
                    const spaceAbove = iconRect.top - headerBottom;
                    if (spaceAbove >= tooltipH + 10) {
                        // Platz oben: Tooltip über dem Icon
                        tooltipContent.classList.remove('tip-below');
                        tooltipContent.classList.add('tip-above');
                        tooltipContent.style.top = (iconRect.top - tooltipH - 8) + 'px';
                    } else {
                        // Zu wenig Platz oben: Tooltip unter dem Icon
                        tooltipContent.classList.remove('tip-above');
                        tooltipContent.classList.add('tip-below');
                        tooltipContent.style.top = (iconRect.bottom + 8) + 'px';
                    }
                    // Horizontal rechts ausrichten
                    const left = Math.max(4, iconRect.right - 210);
                    tooltipContent.style.left = left + 'px';
                });
            }
        });
    };

    // Helper: determines if a fund is a passive ETF
    const isPassiveFund = fund => {
        const nameUpper = fund.name.toUpperCase();
        const typeUpper = (fund.type || '').toUpperCase();
        return nameUpper.includes('ETF') || typeUpper.includes('ETF');
    };

    const populateFilterDropdown = (funds, blockId) => {
        modalFilter.innerHTML = '<option value="all">Alle Managementansätze (Filter)</option>';
        if (!funds) return;

        if (blockId === 'block-maerkte') {
            // Special Aktiv/Passiv filter for Märkte layer
            const optAktiv = document.createElement('option');
            optAktiv.value = '__aktiv__';
            optAktiv.textContent = 'Aktiv';
            modalFilter.appendChild(optAktiv);
            const optPassiv = document.createElement('option');
            optPassiv.value = '__passiv__';
            optPassiv.textContent = 'Passiv';
            modalFilter.appendChild(optPassiv);
            modalFilter.style.display = 'block';
        } else {
            const types = [...new Set(funds.map(f => f.type))].sort();
            types.forEach(t => { const o = document.createElement('option'); o.value = t; o.textContent = t; modalFilter.appendChild(o); });
            modalFilter.style.display = types.length > 1 ? 'block' : 'none';
        }
    };

    modalFilter.addEventListener('change', e => {
        if (!currentBlockData) return;
        let f;
        if (e.target.value === '__aktiv__') {
            f = currentBlockData.funds.filter(fund => !isPassiveFund(fund));
        } else if (e.target.value === '__passiv__') {
            f = currentBlockData.funds.filter(fund => isPassiveFund(fund));
        } else if (e.target.value === 'all') {
            f = currentBlockData.funds;
        } else {
            f = currentBlockData.funds.filter(fund => fund.type === e.target.value);
        }
        renderFundList(f);
    });

    // ── TOWER LAYERS ─────────────────────────────────────────
    const reversedBlocks = [...managementBlocks].reverse();
    reversedBlocks.forEach((block, index) => {
        const blockEl = document.createElement('div');
        blockEl.className = 'tower-layer';
        blockEl.id = block.id;
        blockEl.dataset.blockId = block.id;
        blockEl.style.zIndex = reversedBlocks.length - index;
        blockEl.innerHTML = `
            <div class="layer-selection-count"></div>
            <div class="layer-content">
                <div class="block-title">${block.title}</div>
                <div class="block-subtitle">${block.subtitle}</div>
            </div>`;

        blockEl.addEventListener('click', () => {
            currentBlockData = block;
            modalTitle.textContent = block.title;
            modalFilter.value = 'all';
            populateFilterDropdown(block.funds, block.id);
            renderFundList(block.funds);
            modal.classList.add('open');
        });

        if (block.id === 'block-tagesgeld') {
            if (sideTowerContainer) { blockEl.style.zIndex = 1; sideTowerContainer.appendChild(blockEl); }
        } else {
            if (towerContainer) towerContainer.appendChild(blockEl);
        }
    });

    // ── MODAL CLOSE ──────────────────────────────────────────
    const closeModal = () => {
        modal.classList.remove('open');
        document.querySelectorAll('.tower-layer').forEach(el => {
            el.classList.remove('highlighted', 'exact-match');
            const b = el.querySelector('.exact-match-badge'); if (b) b.remove();
        });
        document.querySelectorAll('.timeline-btn').forEach(b => b.classList.remove('active'));
        
        const dp = document.getElementById('detail-phase-name');
        if (dp) dp.textContent = 'Alle Phasen anzeigen';
        const dd = document.getElementById('detail-duration');
        if (dd) dd.textContent = 'Gesamter Anlagehorizont';
        const da = document.getElementById('detail-asset-class');
        if (da) da.textContent = 'Alle verfügbaren Anlageklassen';
        const dc = document.getElementById('phase-detail-card');
        if (dc) dc.classList.remove('active-state');
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    window.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    // ── PHASE HIGHLIGHTING ───────────────────────────────────
    const highlightBlocks = (mappedIds, exactId) => {
        document.querySelectorAll('.tower-layer').forEach(el => {
            el.classList.remove('highlighted', 'exact-match');
            const b = el.querySelector('.exact-match-badge'); if (b) b.remove();
        });
        mappedIds.forEach(blockId => {
            const b = document.getElementById(blockId);
            if (!b) return;
            b.classList.add('highlighted');
            if (blockId === exactId) {
                b.classList.add('exact-match');
                const bgColor = window.getComputedStyle(b).backgroundColor;
                b.style.setProperty('--badge-color', bgColor);
                const badge = document.createElement('div');
                badge.className = 'exact-match-badge';
                badge.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Passender Ansatz`;
                b.insertBefore(badge, b.firstChild);
            }
        });
    };

    const updateDetails = phase => {
        if (!phase) {
            detailPhaseName.textContent = 'Alle Phasen anzeigen';
            detailDuration.textContent = 'Gesamter Anlagehorizont';
            detailAssetClass.textContent = 'Alle verfügbaren Anlageklassen';
            detailCard.classList.remove('active-state');
            return;
        }
        detailPhaseName.textContent = phase.name;
        detailDuration.textContent = phase.duration;
        detailAssetClass.textContent = phase.assetClass;
        detailCard.classList.add('active-state');
    };

    let activePhaseId = null;

    const handlePhaseClick = phase => {
        if (activePhaseId === phase.id) {
            activePhaseId = null;
            document.querySelectorAll('.timeline-btn').forEach(b => b.classList.remove('active'));
            updateDetails(null);
            document.querySelectorAll('.tower-layer').forEach(el => { el.classList.add('highlighted'); el.classList.remove('exact-match'); const b = el.querySelector('.exact-match-badge'); if (b) b.remove(); });
            return;
        }
        activePhaseId = phase.id;
        document.querySelectorAll('.timeline-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll(`.timeline-btn[data-phase="${phase.id}"]`).forEach(b => b.classList.add('active'));
        updateDetails(phase);
        highlightBlocks(phase.mappedBlocks, phase.exactMatchBlock);
    };

    // ── TIMELINE BUTTONS ─────────────────────────────────────
    zeitphasen.forEach(phase => {
        const btn = document.createElement('button');
        btn.className = 'timeline-btn'; btn.textContent = phase.name; btn.dataset.phase = phase.id;
        btn.addEventListener('click', () => handlePhaseClick(phase));
        timelineContainer.appendChild(btn);
    });

    // ── PDF EXPORT (V4.2) ────────────────────────────────────
    if (savePortfolioBtn) {
        savePortfolioBtn.addEventListener('click', () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const now = new Date();
            const dateStr = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }).replace(':', '-');
            const fileName = `Anlagevorschlag_${formatNumberInput(portfolioGlobals.totalInvestment).replace(/\./g, '')}_EUR_${dateStr.replace(/\./g, '-')}_${timeStr}.pdf`;

            doc.setFontSize(18); doc.setTextColor(3, 61, 93);
            doc.text('Anlagevorschlag - Robustes Portfolio', 14, 20);
            doc.setFontSize(11); doc.setTextColor(50, 50, 50);
            doc.text(`Datum: ${dateStr} ${now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`, 14, 30);
            doc.text(`Anzulegendes Gesamtvermögen: ${formatCurrency(portfolioGlobals.totalInvestment)}`, 14, 38);

            const tableData = [];
            managementBlocks.forEach(block => {
                block.funds.forEach(fund => {
                    const key = `${block.id}::${fund.name}`;
                    const amountEinmal = portfolioGlobals.fundInvestments[key] || 0;
                    const amountSpar = portfolioGlobals.fundSparrates[key] || 0;
                    if (amountEinmal > 0 || amountSpar > 0) {
                        const ertragStr = fund.ertrag ? ` (${fund.ertrag})` : '';
                        let amountStr = '';
                        if (amountEinmal > 0) amountStr += formatCurrency(amountEinmal);
                        if (amountSpar > 0) amountStr += (amountStr ? ' + ' : '') + formatCurrency(amountSpar) + ' mtl.';
                        tableData.push([fund.name, fund.info, `${fund.type}${ertragStr}`, amountStr]);
                    }
                });
            });
            if (tableData.length === 0) return;

            doc.autoTable({
                startY: 45,
                head: [['Fondsname', 'Details (WKN / Info)', 'Ansatz & Ertragsverwendung', 'Anlagebetrag']],
                body: tableData, theme: 'striped',
                headStyles: { fillColor: [3, 61, 93], textColor: 255, fontStyle: 'bold' },
                columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 50 }, 2: { cellWidth: 40 }, 3: { cellWidth: 'auto', halign: 'right' } },
                styles: { fontSize: 9, cellPadding: 4 }
            });

            // Append portfolio selection summary page
            if (portfolio.length > 0) {
                doc.addPage();
                doc.setFontSize(16); doc.setTextColor(3, 61, 93);
                doc.text('Mein Portfolio – Managementansätze & Gewichtung', 14, 20);
                doc.setFontSize(10); doc.setTextColor(80, 80, 80);
                doc.text('Ausgewählte Fonds gruppiert nach Turm-Schicht inkl. prozentualer Gewichtung:', 14, 30);

                const portData = [];
                portfolio.forEach(layer => {
                    layer.funds.forEach((fund, idx) => {
                        portData.push([
                            idx === 0 ? `${layer.blockTitle} (${layer.allocation}%)` : '',
                            fund.name,
                            fund.type,
                            fund.ertrag || '–'
                        ]);
                    });
                });

                doc.autoTable({
                    startY: 38,
                    head: [['Schicht (Gewichtung)', 'Fondsname', 'Ansatz', 'Ertragsverwendung']],
                    body: portData, theme: 'striped',
                    headStyles: { fillColor: [3, 61, 93], textColor: 255, fontStyle: 'bold' },
                    columnStyles: { 0: { cellWidth: 65 }, 1: { cellWidth: 60 }, 2: { cellWidth: 35 }, 3: { cellWidth: 'auto' } },
                    styles: { fontSize: 9, cellPadding: 4 }
                });
            }

            // Chrome/Safari blockieren Downloads von file://-URLs aus Sicherheitsgründen.
            // Lösung: PDF in neuem Tab als Data-URI öffnen → Benutzer kann mit Cmd+S speichern.
            const pdfDataUri = doc.output('datauristring');
            const newTab = window.open('', '_blank');
            if (newTab) {
                newTab.document.write(`
                    <!DOCTYPE html>
                    <html><head>
                        <title>${fileName}</title>
                        <style>
                            body { margin: 0; background: #525659; display: flex; flex-direction: column; align-items: center; font-family: sans-serif; }
                            .toolbar { background: #3c3f41; color: #fff; width: 100%; padding: 10px 20px; box-sizing: border-box;
                                       display: flex; align-items: center; gap: 16px; font-size: 14px; }
                            .toolbar a { background: #0b6895; color: #fff; padding: 7px 18px; border-radius: 6px;
                                         text-decoration: none; font-weight: 600; }
                            .toolbar a:hover { background: #0a5578; }
                            embed { width: 90%; max-width: 900px; height: calc(100vh - 60px); margin-top: 10px; border-radius: 4px; }
                        </style>
                    </head><body>
                        <div class="toolbar">
                            <span>📄 ${fileName}</span>
                            <a href="${pdfDataUri}" download="${fileName}">⬇ PDF speichern</a>
                            <span style="opacity:0.7; font-size:12px;">Oder: Rechtsklick auf das PDF → „Speichern unter"</span>
                        </div>
                        <embed src="${pdfDataUri}" type="application/pdf" />
                    </body></html>`);
                newTab.document.close();
            } else {
                // Fallback wenn Popup-Blocker aktiv: direkt navigieren
                window.location.href = pdfDataUri;
            }

        });
    }

    // ── PANEL ACTIONS ────────────────────────────────────────
    if (exportSetupBtn) {
        exportSetupBtn.addEventListener('click', () => {
            const data = { portfolio: portfolio, globals: portfolioGlobals };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const now = new Date();
            const dateStr = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '-');
            a.download = `portfolio_setup_${dateStr}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    if (importSetupFile) {
        importSetupFile.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                try {
                    const data = JSON.parse(ev.target.result);
                    if (data.portfolio && data.globals) {
                        portfolio = data.portfolio;
                        portfolioGlobals = Object.assign({
                            totalInvestment: 0,
                            totalSparrate: 0,
                            fundInvestments: {},
                            fundSparrates: {}
                        }, data.globals);
                        
                        savePortfolio();
                        saveGlobals();
                        
                        if (totalInvestmentInput) totalInvestmentInput.value = portfolioGlobals.totalInvestment > 0 ? formatNumberInput(portfolioGlobals.totalInvestment) : '';
                        if (totalInvestmentSparrate) totalInvestmentSparrate.value = portfolioGlobals.totalSparrate > 0 ? formatNumberInput(portfolioGlobals.totalSparrate) : '';
                        
                        updateFinancialOverview();
                        renderPanel();
                        if (currentBlockData) { renderFundList(currentBlockData.funds); refreshModalButtons(); }
                        alert("Setup erfolgreich geladen!");
                    } else {
                        alert("Ungültige Setup-Datei: 'portfolio' oder 'globals' fehlen.");
                    }
                } catch (err) {
                    alert("Fehler beim Lesen der Datei. Ist es ein gültiges JSON?");
                }
                e.target.value = ''; // reset file input
            };
            reader.readAsText(file);
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Eigenes Bestätigungs-Popup (kein confirm() wegen mouseup-Bug bei file://)
            const existing = document.getElementById('reset-confirm-popup');
            if (existing) { existing.remove(); return; }

            const popup = document.createElement('div');
            popup.id = 'reset-confirm-popup';
            popup.style.cssText = `
                position: absolute;
                background: #1e2d42;
                color: #fff;
                border-radius: 8px;
                padding: 14px 18px;
                font-size: 0.85rem;
                box-shadow: 0 6px 24px rgba(0,0,0,0.4);
                z-index: 999999;
                min-width: 240px;
                white-space: normal;
                border: 1px solid rgba(255,255,255,0.2);
            `;

            // Position relativ zum Button
            const btnRect = resetBtn.getBoundingClientRect();
            popup.style.position = 'fixed';
            popup.style.top  = (btnRect.bottom + 8) + 'px';
            popup.style.left = Math.max(4, btnRect.left - 80) + 'px';

            popup.innerHTML = `
                <p style="margin:0 0 12px 0; line-height:1.4;">Portfolio zurücksetzen?<br>
                <small style="opacity:0.75;">Alle Fonds und Beträge werden gelöscht.</small></p>
                <div style="display:flex; gap:8px; justify-content:flex-end;">
                    <button id="reset-cancel-btn"
                        style="padding:6px 14px; border-radius:6px; border:1px solid rgba(255,255,255,0.3);
                               background:transparent; color:#fff; cursor:pointer; font-size:0.82rem;">
                        Nein
                    </button>
                    <button id="reset-confirm-btn"
                        style="padding:6px 14px; border-radius:6px; border:none;
                               background:#e53e3e; color:#fff; cursor:pointer; font-size:0.82rem; font-weight:600;">
                        Ja, zurücksetzen
                    </button>
                </div>`;

            document.body.appendChild(popup);

            const closePopup = () => popup.remove();

            document.getElementById('reset-cancel-btn').addEventListener('click', (ev) => {
                ev.stopPropagation(); closePopup();
            });

            document.getElementById('reset-confirm-btn').addEventListener('click', (ev) => {
                ev.stopPropagation();
                closePopup();
                portfolioGlobals = { totalInvestment: 0, totalSparrate: 0, fundInvestments: {}, fundSparrates: {} };
                saveGlobals();
                if (totalInvestmentInput) totalInvestmentInput.value = '';
                if (totalInvestmentSparrate) totalInvestmentSparrate.value = '';
                // Reset Upload-Button-Label
                const depLbl = document.getElementById('depot-upload-label');
                const depTxt = document.getElementById('depot-upload-label-text');
                const depInp = document.getElementById('depot-upload-input');
                if (depLbl) { depLbl.classList.remove('pdf-loading','pdf-loaded'); }
                if (depTxt) depTxt.textContent = 'Depot laden (CSV / Excel)';
                if (depInp) depInp.value = '';
                // Delistete Fonds-Daten löschen
                try { localStorage.removeItem('delistedFunds_V44'); } catch(e){}
                resetPortfolio();
                updateFinancialOverview();
                renderPanel();
                if (currentBlockData) { renderFundList(currentBlockData.funds); refreshModalButtons(); }
            });

            // Klick außerhalb schließt das Popup
            setTimeout(() => {
                document.addEventListener('click', closePopup, { once: true });
            }, 50);
        });
    }
    if (printOverallBtn) printOverallBtn.addEventListener('click', () => window.print());

    // ── CRAWLER MODAL ─────────────────────────────────────────
    const crawlerBtn       = document.getElementById('crawler-btn');
    const crawlerModal     = document.getElementById('crawler-modal');
    const crawlerModalClose= document.getElementById('crawler-modal-close');
    const crawlerNoServer  = document.getElementById('crawler-no-server');
    const crawlerReady     = document.getElementById('crawler-ready');
    const crawlerRunning   = document.getElementById('crawler-running');
    const crawlerDone      = document.getElementById('crawler-done');
    const crawlerStartBtn  = document.getElementById('crawler-start-btn');
    const crawlerLog       = document.getElementById('crawler-log');
    const crawlerBar       = document.getElementById('crawler-progress-bar');
    const crawlerLabel     = document.getElementById('crawler-progress-label');
    const crawlerDoneMsg   = document.getElementById('crawler-done-msg');
    const copyCmdBtn       = document.getElementById('copy-cmd-btn');
    let pollInterval       = null;

    const SERVER = `http://localhost:${CRAWLER_PORT}`;

    const showPane = (pane) => {
        [crawlerNoServer, crawlerReady, crawlerRunning, crawlerDone]
            .forEach(el => el && (el.style.display = 'none'));
        if (pane) pane.style.display = 'block';
    };

    const appendLog = (msg, color = '#cdd6f4') => {
        if (!crawlerLog) return;
        const line = document.createElement('div');
        line.style.color = color;
        line.textContent = msg;
        crawlerLog.appendChild(line);
        crawlerLog.scrollTop = crawlerLog.scrollHeight;
    };

    const stopPolling = () => { if (pollInterval) { clearInterval(pollInterval); pollInterval = null; } };

    const pollStatus = () => {
        fetch(`${SERVER}/status`)
            .then(r => r.json())
            .then(data => {
                const steps = data.progress || [];
                const total = steps.length > 0 ? steps[steps.length-1].total || 1 : 1;
                const done  = steps.filter(s => s.status !== 'running').length;
                if (crawlerBar)  crawlerBar.style.width = `${Math.round((done/total)*100)}%`;
                if (crawlerLabel) crawlerLabel.textContent = `[${done}/${total}] ${steps.length > 0 ? steps[steps.length-1].fund : ''}...`;
                if (steps.length > crawlerLog.children.length) {
                    const last = steps[steps.length-1];
                    const ok = ['ok','ok_fallback'].includes(last.status);
                    appendLog(`[${done}/${total}] ${last.fund}: ${ok ? '✅' : '❌'} ${last.status}`,
                              ok ? '#a6e3a1' : '#f38ba8');
                }
                if (data.done) {
                    stopPolling();
                    const okCount = steps.filter(s => ['ok','ok_fallback'].includes(s.status)).length;
                    crawlerDoneMsg.textContent = `Fertig! ✅ ${okCount} Fonds aktualisiert, ❌ ${steps.length - okCount} nicht gefunden.`;
                    showPane(crawlerDone);
                }
                if (data.error) {
                    stopPolling();
                    appendLog(`Fehler: ${data.error}`, '#f38ba8');
                }
            })
            .catch(() => stopPolling());
    };

    if (crawlerBtn) {
        crawlerBtn.addEventListener('click', () => {
            // ── Passwortschutz ──────────────────────────────
            const pwOverlay = document.createElement('div');
            pwOverlay.style.cssText = `
                position:fixed; inset:0; background:rgba(0,0,0,0.65);
                display:flex; align-items:center; justify-content:center; z-index:9999;`;
            pwOverlay.innerHTML = `
                <div style="background:#1e2130; border:1px solid #3d4258; border-radius:14px;
                    padding:36px 40px; min-width:320px; text-align:center; box-shadow:0 8px 40px rgba(0,0,0,0.5);">
                    <div style="font-size:2em; margin-bottom:12px;">🔒</div>
                    <div style="color:#e0e4f0; font-size:1.1em; font-weight:600; margin-bottom:6px;">Zugang geschützt</div>
                    <div style="color:#9aa0bc; font-size:0.88em; margin-bottom:22px;">Bitte PIN eingeben, um die Aktualisierung zu starten.</div>
                    <input id="pw-input" type="password" maxlength="20"
                        placeholder="PIN eingeben"
                        style="width:100%; box-sizing:border-box; padding:10px 14px; font-size:1.1em;
                            border:1.5px solid #3d4258; border-radius:8px; background:#131520;
                            color:#e0e4f0; outline:none; text-align:center; letter-spacing:4px;"
                    />
                    <div id="pw-error" style="color:#f38ba8; font-size:0.85em; margin-top:10px; min-height:18px;"></div>
                    <div style="display:flex; gap:12px; margin-top:20px; justify-content:center;">
                        <button id="pw-cancel" style="padding:9px 24px; border-radius:8px; border:1px solid #3d4258;
                            background:transparent; color:#9aa0bc; cursor:pointer; font-size:0.95em;">Abbrechen</button>
                        <button id="pw-confirm" style="padding:9px 28px; border-radius:8px; border:none;
                            background:#034d6e; color:#fff; cursor:pointer; font-size:0.95em; font-weight:600;">Bestätigen</button>
                    </div>
                </div>`;
            document.body.appendChild(pwOverlay);
            const pwInput   = pwOverlay.querySelector('#pw-input');
            const pwError   = pwOverlay.querySelector('#pw-error');
            const pwConfirm = pwOverlay.querySelector('#pw-confirm');
            const pwCancel  = pwOverlay.querySelector('#pw-cancel');
            setTimeout(() => pwInput.focus(), 50);

            const checkPw = () => {
                if (pwInput.value === '220363') {
                    document.body.removeChild(pwOverlay);
                    // ── Original Crawler-Logik ──────────────
                    crawlerModal.style.display = 'flex';
                    showPane(null);
                    fetch(`${SERVER}/ping`, { signal: AbortSignal.timeout(2500) })
                        .then(r => r.json())
                        .then(() => showPane(crawlerReady))
                        .catch(() => showPane(crawlerNoServer));
                } else {
                    pwError.textContent = 'Falsche PIN. Bitte erneut versuchen.';
                    pwInput.value = '';
                    pwInput.focus();
                    pwInput.style.borderColor = '#f38ba8';
                    setTimeout(() => { pwInput.style.borderColor = '#3d4258'; pwError.textContent = ''; }, 2000);
                }
            };

            pwConfirm.addEventListener('click', checkPw);
            pwInput.addEventListener('keydown', e => { if (e.key === 'Enter') checkPw(); });
            pwCancel.addEventListener('click', () => document.body.removeChild(pwOverlay));
            pwOverlay.addEventListener('click', e => { if (e.target === pwOverlay) document.body.removeChild(pwOverlay); });
        });
    }

    if (crawlerModalClose) {
        crawlerModalClose.addEventListener('click', () => {
            crawlerModal.style.display = 'none';
            stopPolling();
        });
    }
    window.addEventListener('click', e => {
        if (e.target === crawlerModal) { crawlerModal.style.display = 'none'; stopPolling(); }
    });

    if (copyCmdBtn) {
        copyCmdBtn.addEventListener('click', () => {
            const dir = window.location.href.replace('index.html','').replace('file://','');
            const cmd = `cd "${decodeURIComponent(dir)}" && python3 crawler_server.py`;
            navigator.clipboard.writeText(cmd).then(() => { copyCmdBtn.textContent = '✅ Kopiert!'; setTimeout(() => { copyCmdBtn.textContent = '\uD83D\uDCCB Kopieren'; }, 2000); });
        });
    }

    if (crawlerStartBtn) {
        crawlerStartBtn.addEventListener('click', () => {
            showPane(crawlerRunning);
            crawlerLog.innerHTML = '';
            if (crawlerBar) crawlerBar.style.width = '0%';
            if (crawlerLabel) crawlerLabel.textContent = 'Starte Crawler...';
            appendLog('Verbinde mit Crawle-Server...');
            fetch(`${SERVER}/run`, { method: 'POST' })
                .then(r => r.json())
                .then(d => {
                    if (d.ok) {
                        appendLog('Crawler gestartet \uD83D\uDE80', '#89b4fa');
                        pollInterval = setInterval(pollStatus, 2000);
                    } else {
                        appendLog(`Fehler: ${d.error}`, '#f38ba8');
                    }
                })
                .catch(e => appendLog(`Verbindungsfehler: ${e}`, '#f38ba8'));
        });
    }

    // ═══════════════════════════════════════════════════════════
    //  V4.4 – UNIVERSAL DEPOT IMPORT (CSV / XLSX / PDF)
    //         + DEPOT-BIBLIOTHEK + DELISTED-ICON
    // ═══════════════════════════════════════════════════════════

    const LIBRARY_KEY = 'depotBibliothek_V44';

    // ── Anlageschwerpunkt → Block-Mapping ─────────────────────
    // Gibt blockId zurück oder null wenn nicht eindeutig
    function anlageschwerpunktToBlock(schwerpunkt) {
        if (!schwerpunkt) return null;
        const s = schwerpunkt.toLowerCase().trim();
        if (s.includes('geldmarkt')) return 'block-kasse';
        if (s.includes('anleihen euro kurz') || s.includes('anleihen euro kurz laufzeit') ||
            s.includes('anleihen hochzins laufzeit')) return 'block-kasse';
        if (s.includes('anleihen') || s.includes('renten') || s.includes('bond')) return 'block-defensiv';
        if (s.includes('vermögensverwalter - defensiv') || s.includes('verm') && s.includes('defensiv')) return 'block-defensiv';
        if (s.includes('vermögensverwalter - ausgewogen') || s.includes('verm') && s.includes('ausgewogen')) return 'block-ausgewogen';
        if (s.includes('vermögensverwalter - dynamisch') || s.includes('verm') && s.includes('dynamisch')) return 'block-dynamisch';
        if (s.includes('aktien')) return 'block-maerkte';
        return null; // ambiguous
    }

    // ── Bibliothek: Lesen / Schreiben ─────────────────────────
    function loadLibrary() {
        try { const r = localStorage.getItem(LIBRARY_KEY); if (r) return JSON.parse(r); } catch(e) {}
        return [];
    }
    function saveLibraryEntry(name, sourceFile, data) {
        const lib = loadLibrary();
        const idx = lib.findIndex(e => e.name === name);
        const entry = {
            name, sourceFile,
            savedAt: new Date().toISOString(),
            fundCount: Object.keys(data.globals.fundInvestments || {}).length,
            totalValue: data.globals.totalInvestment || 0,
            data
        };
        if (idx > -1) lib[idx] = entry; else lib.unshift(entry);
        localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib));
        return entry;
    }
    function deleteLibraryEntry(name) {
        const lib = loadLibrary().filter(e => e.name !== name);
        localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib));
    }
    function exportLibraryEntryAsJson(entry) {
        const blob = new Blob([JSON.stringify(entry.data, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `${entry.name}.json`; a.click();
        URL.revokeObjectURL(url);
    }

    // ── Gemeinsame Hilfsfunktionen ────────────────────────────
    function parseGermanNumber(s) {
        if (!s) return 0;
        const cleaned = String(s).replace(/\./g,'').replace(',','.');
        const v = parseFloat(cleaned);
        return isNaN(v) ? 0 : v;
    }
    function normalizeWKN(wkn) {
        return String(wkn).toUpperCase().replace(/[^A-Z0-9]/g,'');
    }
    function buildWknLookup() {
        const map = {};
        managementBlocks.forEach(block => {
            block.funds.forEach(fund => {
                if (fund._isDelistet || fund._isEmpfehlungsliste) return;
                const matches = fund.info.matchAll(/WKN:\s*([A-Z0-9]{6})/gi);
                for (const m of matches) {
                    const wkn = normalizeWKN(m[1]);
                    if (!map[wkn]) map[wkn] = [];
                    map[wkn].push({ block, fund });
                }
            });
        });
        // Deduplizierung: Wenn eine WKN in mehreren Blöcken vorkommt,
        // block-tagesgeld ignorieren – Kapitalreservefonds (block-kasse) hat Vorrang.
        Object.keys(map).forEach(wkn => {
            if (map[wkn].length > 1) {
                const nonTagesgeld = map[wkn].filter(e => e.block.id !== 'block-tagesgeld');
                if (nonTagesgeld.length > 0) map[wkn] = nonTagesgeld;
            }
        });
        return map;
    }

    // ── CSV PARSER ────────────────────────────────────────────
    function parseCsvDepot(text, wknLookup) {
        const matched = [], unmatched = [];
        function cleanAmount(s) { return s.replace(/[^\d.,]/g, '').trim(); }

        const clean = text
            .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
            .replace(/F[^\s]*r diesen Fonds.*?(?=\n|$)/gi, '')
            .split('\n');

        for (let i = 0; i < clean.length; i++) {
            const cols = clean[i].split(';');
            const wknRaw = (cols[0] || '').trim();
            const wkn    = normalizeWKN(wknRaw);
            if (wkn.length !== 6) continue;

            const schwerpunkt = (cols[2] || '').trim();
            const betragRaw   = cleanAmount(cols[4] || cols[3] || '');
            const sparrateRaw = cleanAmount(cols[6] || cols[5] || '');
            const einmal      = parseGermanNumber(betragRaw);
            const sparrate    = parseGermanNumber(sparrateRaw);
            if (einmal <= 0 && sparrate <= 0) continue;

            const nameRaw = i + 1 < clean.length ? (clean[i+1].split(';')[0] || '').trim() : '';

            if (wknLookup[wkn]) {
                wknLookup[wkn].forEach(entry => {
                    if (!matched.some(m => m.block.id === entry.block.id && m.fund.name === entry.fund.name))
                        matched.push({ block: entry.block, fund: entry.fund, einmal, sparrate, wkn, schwerpunkt });
                });
            } else {
                if (!unmatched.some(u => u.wkn === wkn))
                    unmatched.push({ name: nameRaw || `Unbekannter Fonds (${wkn})`, wkn, einmal, sparrate, schwerpunkt });
            }
        }
        return { matched, unmatched };
    }

    // ── XLSX PARSER ───────────────────────────────────────────
    function parseXlsxDepot(workbook, wknLookup) {
        const matched = [], unmatched = [];
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const wkn = normalizeWKN(String(row[0] || '').trim());
            if (wkn.length !== 6) continue;
            const schwerpunkt = String(row[2] || '').trim();
            let einmal = 0, sparrate = 0;
            for (let c = 1; c < row.length; c++) {
                const v = parseGermanNumber(String(row[c] || ''));
                if (v > 0 && einmal === 0) einmal = v;
                else if (v > 0 && sparrate === 0 && c > 2) sparrate = v;
            }
            if (einmal <= 0 && sparrate <= 0) continue;
            const nameRaw = i + 1 < rows.length ? String(rows[i+1][0] || '').trim() : '';
            if (wknLookup[wkn]) {
                wknLookup[wkn].forEach(entry => {
                    if (!matched.some(m => m.block.id === entry.block.id && m.fund.name === entry.fund.name))
                        matched.push({ block: entry.block, fund: entry.fund, einmal, sparrate, wkn, schwerpunkt });
                });
            } else {
                if (!unmatched.some(u => u.wkn === wkn))
                    unmatched.push({ name: nameRaw || `Unbekannter Fonds (${wkn})`, wkn, einmal, sparrate, schwerpunkt });
            }
        }
        return { matched, unmatched };
    }

    // ── PDF PARSER (Textlayer) ────────────────────────────────
    if (typeof pdfjsLib !== 'undefined')
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    async function extractPdfText(file) {
        if (typeof pdfjsLib === 'undefined') throw new Error('PDF.js nicht geladen.');
        const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const content = await (await pdf.getPage(i)).getTextContent();
            const items = content.items.sort((a,b) => {
                const ay = Math.round(a.transform[5]*10), by = Math.round(b.transform[5]*10);
                return ay !== by ? by - ay : a.transform[4] - b.transform[4];
            });
            fullText += items.map(it => it.str).join(' ') + '\n';
        }
        return fullText;
    }
    function parsePdfData(text, wknLookup) {
        const matched = [], unmatched = [];
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const wknPat = /\b([A-Z0-9]{6})\b/g;
        const amtPat = /(\d{1,3}(?:\.\d{3})*,\d{2})/g;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const wkns = []; let wm;
            wknPat.lastIndex = 0;
            while ((wm = wknPat.exec(line)) !== null) wkns.push(wm[1]);
            const ctx = [line, lines[i+1]||'', lines[i+2]||''].join(' ');
            const amts = []; let am;
            amtPat.lastIndex = 0;
            while ((am = amtPat.exec(ctx)) !== null) amts.push(parseGermanNumber(am[1]));
            for (const wknRaw of wkns) {
                const wkn = normalizeWKN(wknRaw);
                if (wkn.length !== 6) continue;
                if (wknLookup[wkn]) {
                    if ((amts[0]||0) <= 0) continue;
                    wknLookup[wkn].forEach(entry => {
                        if (!matched.some(m => m.block.id === entry.block.id && m.fund.name === entry.fund.name))
                            matched.push({ block: entry.block, fund: entry.fund, einmal: amts[0], sparrate: amts[1]||0, wkn, schwerpunkt: '' });
                    });
                } else if ((amts[0]||0) > 0) {
                    const prev = lines.slice(Math.max(0,i-3),i).filter(l => !/^\d/.test(l) && l.length > 5);
                    if (!unmatched.some(u => u.wkn === wkn))
                        unmatched.push({ name: prev.at(-1) || `(${wkn})`, wkn, einmal: amts[0], sparrate: amts[1]||0, schwerpunkt: '' });
                }
            }
        }
        return { matched, unmatched };
    }

    // ── "Von Empfehlungsliste genommen" Schlüssel ─────────────
    const EMPFEHLUNG_KEY_PREFIX = 'empfehlungsliste';
    function empfehlungsKey(blockId) { return `${blockId}::${EMPFEHLUNG_KEY_PREFIX}`; }

    // ── Import anwenden ───────────────────────────────────────
    // mapped = eindeutig zugeordnete nicht-gematchte Fonds {blockId, schwerpunkt, einmal, sparrate, name, wkn}
    function applyImport(matched, mappedUnmatched) {
        const totalEinmal = matched.reduce((s,m) => s + m.einmal, 0);
        matched.forEach(({ block, fund, einmal, sparrate }) => {
            const key = `${block.id}::${fund.name}`;
            if (einmal   > 0) { portfolioGlobals.fundInvestments[key] = einmal;  addFund(block, fund); }
            if (sparrate > 0) { portfolioGlobals.fundSparrates[key]   = sparrate; addFund(block, fund); }
        });
        // Unmatched mit eindeutiger Schicht → "Von Empfehlungsliste genommen"
        if (mappedUnmatched && mappedUnmatched.length > 0) {
            // Änderung 2: Speichere die Fonddetails pro Schicht für das Popup
            const empFondsMap = {};
            try { Object.assign(empFondsMap, JSON.parse(localStorage.getItem('empfehlungslisteFonds_V44') || '{}')); } catch {}
            mappedUnmatched.forEach(u => {
                const { blockId, einmal, sparrate } = u;
                const eKey = empfehlungsKey(blockId);
                portfolioGlobals.fundInvestments[eKey] = (portfolioGlobals.fundInvestments[eKey] || 0) + einmal;
                if (sparrate > 0) portfolioGlobals.fundSparrates[eKey] = (portfolioGlobals.fundSparrates[eKey] || 0) + sparrate;
                // Fonddetails für Popup speichern
                if (!empFondsMap[blockId]) empFondsMap[blockId] = [];
                if (!empFondsMap[blockId].some(f => f.wkn === u.wkn))
                    empFondsMap[blockId].push({ name: u.name, wkn: u.wkn, schwerpunkt: u.schwerpunkt, einmal: u.einmal, sparrate: u.sparrate || 0 });
                // Sicherstellen dass die Schicht existiert
                const block = managementBlocks.find(b => b.id === blockId);
                if (block) {
                    const layer = getOrCreateLayer(block.id, block.title);
                    // Pseudofond "Von Empfehlungsliste" als Marker
                    if (!layer.funds.some(f => f._isEmpfehlungsliste))
                        layer.funds.push({ name: EMPFEHLUNG_KEY_PREFIX, info: '', type: '', ertrag: '', _isEmpfehlungsliste: true });
                }
            });
            localStorage.setItem('empfehlungslisteFonds_V44', JSON.stringify(empFondsMap));
        }
        // totalInvestment = gematchte Fonds + Empfehlungsliste-Fonds (mappedUnmatched)
        // → Gesamtvermögen = Summe aller importierten Beträge → verbleibend = 0,00
        // Der User kann das Gesamtvermögen danach manuell erhöhen.
        const totalMappedUnmatched = (mappedUnmatched || []).reduce((s, u) => s + (u.einmal || 0), 0);
        const totalEinmalGesamt = totalEinmal + totalMappedUnmatched;
        if (portfolioGlobals.totalInvestment === 0 && totalEinmalGesamt > 0) {
            portfolioGlobals.totalInvestment = totalEinmalGesamt;
            if (totalInvestmentInput) totalInvestmentInput.value = formatNumberInput(totalEinmalGesamt);
        }
        saveGlobals(); savePortfolio();
    }

    // ── Unmatched klassifizieren ──────────────────────────────
    function classifyUnmatched(unmatched) {
        const mapped   = []; // { blockId, name, wkn, schwerpunkt, einmal, sparrate }
        const ambiguous= []; // { name, wkn, schwerpunkt, einmal, sparrate }
        unmatched.forEach(u => {
            const blockId = anlageschwerpunktToBlock(u.schwerpunkt);
            if (blockId) mapped.push({ ...u, blockId });
            else ambiguous.push(u);
        });
        return { mapped, ambiguous };
    }

    // ── Import-JSON bauen ─────────────────────────────────────
    function buildImportJson(matched, unmatched) {
        const globals = {
            totalInvestment: matched.reduce((s,m) => s + m.einmal, 0),
            totalSparrate:   matched.reduce((s,m) => s + m.sparrate, 0),
            fundInvestments: {}, fundSparrates: {}
        };
        matched.forEach(({ block, fund, einmal, sparrate }) => {
            const key = `${block.id}::${fund.name}`;
            if (einmal   > 0) globals.fundInvestments[key] = einmal;
            if (sparrate > 0) globals.fundSparrates[key]   = sparrate;
        });
        const layerMap = {};
        matched.forEach(({ block, fund }) => {
            if (!layerMap[block.id]) layerMap[block.id] = { blockId: block.id, blockTitle: block.title, allocation: 0, funds: [] };
            if (!layerMap[block.id].funds.some(f => f.name === fund.name))
                layerMap[block.id].funds.push({ name: fund.name, info: fund.info, type: fund.type, ertrag: fund.ertrag || '' });
        });
        const ORDER = managementBlocks.map(b => b.id);
        return { portfolio: ORDER.filter(id => layerMap[id]).map(id => layerMap[id]), globals, unmatched };
    }

    // ── Delisted-Icon in Panel (für ambiguous unmatched) ────── 
    // Diese Daten werden nach dem Import gespeichert und beim Re-Render angezeigt
    const DELISTED_KEY = 'delistedFunds_V44';
    function saveDelisted(funds) { localStorage.setItem(DELISTED_KEY, JSON.stringify(funds)); }
    function loadDelisted()      { try { return JSON.parse(localStorage.getItem(DELISTED_KEY) || '[]'); } catch { return []; } }

    // ── Import-Ergebnis-Modal ─────────────────────────────────
    const depotUploadInput = document.getElementById('depot-upload-input');
    const depotUploadLabel = document.getElementById('depot-upload-label');
    const depotLabelText   = document.getElementById('depot-upload-label-text');
    const procModal        = document.getElementById('pdf-processing-modal');
    const importResultMod  = document.getElementById('pdf-import-modal');
    const importResultClose= document.getElementById('pdf-import-modal-close');
    const importResultOk   = document.getElementById('pdf-import-modal-ok');
    const importResultSumm = document.getElementById('pdf-import-summary');
    const unmatchedSection = document.getElementById('pdf-unmatched-section');
    const unmatchedList    = document.getElementById('pdf-unmatched-list');
    const unmatchedCount   = document.getElementById('pdf-unmatched-count');
    const importSaveName   = document.getElementById('import-save-name');
    const importSaveBtn    = document.getElementById('import-save-btn');
    const importLoadBtn    = document.getElementById('import-load-btn');
    const importJsonDlBtn  = document.getElementById('import-json-dl-btn');

    let _lastImportResult = null;

    const closeImportModal = () => { if (importResultMod) { importResultMod.classList.remove('open'); setTimeout(() => { importResultMod.style.display = 'none'; }, 310); } };
    if (importResultClose) importResultClose.addEventListener('click', closeImportModal);
    if (importResultOk)    importResultOk.addEventListener('click', closeImportModal);
    if (importResultMod)   importResultMod.addEventListener('click', e => { if (e.target === importResultMod) closeImportModal(); });

    function showImportResult(matched, unmatched, baseName) {
        const { mapped, ambiguous } = classifyUnmatched(unmatched);
        _lastImportResult = { matched, unmatched, mapped, ambiguous, baseName };
        if (!importResultMod || !importResultSumm) return;

        const titleEl = document.getElementById('pdf-import-modal-title');
        if (titleEl) titleEl.textContent = `📊 Import: ${baseName}`;
        if (importSaveName) importSaveName.value = baseName;

        const totalE = matched.reduce((s,m) => s + m.einmal, 0);
        const totalS = matched.reduce((s,m) => s + m.sparrate, 0);
        const mappedTotal = mapped.reduce((s,u) => s + u.einmal, 0);

        importResultSumm.innerHTML = `
            <div class="pdf-import-stat success">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <div><strong>${matched.length}</strong> Fonds erkannt &amp; zugeordnet – ${matched.length === 0 ? 'keine' : formatCurrency(totalE)}</div>
            </div>
            ${mapped.length > 0 ? `<div class="pdf-import-stat info">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <div><strong>${mapped.length}</strong> Fonds nicht in Datenbank, aber Schicht eindeutig → in <em>„Von Empfehlungsliste genommen"</em> eingetragen (${formatCurrency(mappedTotal)})</div>
            </div>` : ''}
            ${ambiguous.length > 0 ? `<div class="pdf-import-stat warning">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div><strong>${ambiguous.length}</strong> Fonds mit unklarer Schicht → werden als <em>„Fonds delistet"</em> gespeichert</div>
            </div>` : ''}
            ${matched.length === 0 && mapped.length === 0 && ambiguous.length === 0 ? `<div class="pdf-import-stat warning">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <div>Keine Fondsdaten erkannt. Bitte Dateiformat prüfen (CSV, XLSX oder maschinenlesbare PDF).</div>
            </div>` : ''}`;

        // Unmatched-Liste (kombiniert mapped + ambiguous)
        const allUnmatched = [...mapped, ...ambiguous];
        if (allUnmatched.length > 0 && unmatchedSection && unmatchedList) {
            if (unmatchedCount) unmatchedCount.textContent = allUnmatched.length;
            unmatchedList.innerHTML = allUnmatched.map(u => {
                const blockId = anlageschwerpunktToBlock(u.schwerpunkt);
                const blockName = blockId ? (managementBlocks.find(b => b.id === blockId)?.title || blockId) : '—';
                const badge = blockId
                    ? `<span style="background:#0a7a4d;color:#fff;padding:2px 7px;border-radius:4px;font-size:0.75rem;">→ ${blockName}</span>`
                    : `<span style="background:#d97706;color:#fff;padding:2px 7px;border-radius:4px;font-size:0.75rem;">Schicht unklar</span>`;
                return `<div class="pdf-unmatched-item">
                    <div>
                        <span class="pdf-unmatched-item-name">${u.name}</span>
                        <span class="pdf-unmatched-item-wkn">WKN: ${u.wkn} · ${u.schwerpunkt||'?'}</span>
                        ${badge}
                    </div>
                    <div class="pdf-unmatched-item-amt">
                        ${u.einmal  > 0 ? `<span>${formatCurrency(u.einmal)}</span>` : ''}
                        ${u.sparrate > 0 ? `<small>${formatCurrency(u.sparrate)} mtl.</small>` : ''}
                    </div>
                </div>`;
            }).join('');
            unmatchedSection.style.display = 'block';
        } else if (unmatchedSection) unmatchedSection.style.display = 'none';

        importResultMod.style.display = '';
        importResultMod.classList.add('open');
    }

    // Speichern
    if (importSaveBtn) {
        importSaveBtn.addEventListener('click', () => {
            if (!_lastImportResult) return;
            const name = (importSaveName?.value || _lastImportResult.baseName).trim() || _lastImportResult.baseName;
            saveLibraryEntry(name, _lastImportResult.baseName, buildImportJson(_lastImportResult.matched, _lastImportResult.unmatched));
            importSaveBtn.textContent = '✅ Gespeichert!';
            setTimeout(() => { importSaveBtn.textContent = '💾 In Bibliothek speichern'; }, 2000);
        });
    }

    // Laden
    if (importLoadBtn) {
        importLoadBtn.addEventListener('click', () => {
            if (!_lastImportResult) return;
            const { matched, mapped, ambiguous } = _lastImportResult;
            saveDelisted(ambiguous);
            applyImport(matched, mapped);
            updateFinancialOverview(); renderPanel();
            if (currentBlockData) { renderFundList(currentBlockData.funds); refreshModalButtons(); }
            closeImportModal();
        });
    }

    // JSON herunterladen
    if (importJsonDlBtn) {
        importJsonDlBtn.addEventListener('click', () => {
            if (!_lastImportResult) return;
            const name = (importSaveName?.value || _lastImportResult.baseName).trim() || _lastImportResult.baseName;
            const blob = new Blob([JSON.stringify(buildImportJson(_lastImportResult.matched, _lastImportResult.unmatched), null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `${name}.json`; a.click();
            URL.revokeObjectURL(url);
        });
    }

    // ── Depot-Bibliothek Modal ────────────────────────────────
    const libModal      = document.getElementById('library-modal');
    const libModalClose = document.getElementById('library-modal-close');
    const libOpenBtn    = document.getElementById('library-open-btn');
    const libList       = document.getElementById('library-list');
    const libEmpty      = document.getElementById('library-empty');
    const libImportFile = document.getElementById('library-import-file');

    const openLibModal  = () => { renderLibraryModal(); if (libModal) { libModal.style.display = ''; libModal.classList.add('open'); } };
    const closeLibModal = () => { if (libModal) { libModal.classList.remove('open'); setTimeout(() => { libModal.style.display = 'none'; }, 310); } };
    if (libModalClose) libModalClose.addEventListener('click', closeLibModal);
    if (libModal)      libModal.addEventListener('click', e => { if (e.target === libModal) closeLibModal(); });
    if (libOpenBtn)    libOpenBtn.addEventListener('click', openLibModal);

    if (libImportFile) {
        libImportFile.addEventListener('change', e => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                try {
                    const data = JSON.parse(ev.target.result);
                    if (!data.portfolio || !data.globals) { alert('Ungültige JSON-Datei.'); return; }
                    const name = file.name.replace(/\.json$/i,'');
                    saveLibraryEntry(name, file.name, data);
                    renderLibraryModal();
                    alert(`✅ "${name}" zur Bibliothek hinzugefügt.`);
                } catch { alert('JSON-Datei konnte nicht gelesen werden.'); }
            };
            reader.readAsText(file); e.target.value = '';
        });
    }

    function renderLibraryModal() {
        if (!libList) return;
        const lib = loadLibrary();
        if (lib.length === 0) {
            libList.innerHTML = '';
            if (libEmpty) libEmpty.style.display = 'block';
            return;
        }
        if (libEmpty) libEmpty.style.display = 'none';
        libList.innerHTML = lib.map((entry, i) => `
            <div class="lib-entry" data-idx="${i}">
                <div class="lib-entry-icon">📄</div>
                <div class="lib-entry-info">
                    <div class="lib-entry-name">${entry.name}</div>
                    <div class="lib-entry-meta">
                        <span>${entry.fundCount} Fonds</span><span>·</span>
                        <span>${formatCurrency(entry.totalValue)}</span><span>·</span>
                        <span>${new Date(entry.savedAt).toLocaleDateString('de-DE')}</span>
                    </div>
                </div>
                <div class="lib-entry-actions">
                    <button class="lib-btn lib-btn-load" data-name="${entry.name}">▶ Laden</button>
                    <button class="lib-btn lib-btn-dl"   data-name="${entry.name}">⬇ JSON</button>
                    <button class="lib-btn lib-btn-del"  data-name="${entry.name}">🗑</button>
                </div>
            </div>`).join('');

        libList.querySelectorAll('.lib-btn-load').forEach(btn => {
            btn.addEventListener('click', () => {
                const entry = loadLibrary().find(e => e.name === btn.dataset.name);
                if (!entry) return;
                loadPortfolioFromJson(entry.data);
                closeLibModal();
            });
        });
        libList.querySelectorAll('.lib-btn-dl').forEach(btn => {
            btn.addEventListener('click', () => {
                const entry = loadLibrary().find(e => e.name === btn.dataset.name);
                if (entry) exportLibraryEntryAsJson(entry);
            });
        });
        libList.querySelectorAll('.lib-btn-del').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!confirm(`Eintrag „${btn.dataset.name}" löschen?`)) return;
                deleteLibraryEntry(btn.dataset.name);
                renderLibraryModal();
            });
        });
    }

    function loadPortfolioFromJson(data) {
        portfolio = JSON.parse(JSON.stringify(data.portfolio || []));
        const loadedFundInvestments = data.globals?.fundInvestments || {};
        const loadedFundSparrates   = data.globals?.fundSparrates   || {};
        // totalInvestment immer aus fundInvestments neu berechnen –
        // der gespeicherte Wert kann durch frühere Bugs falsch sein.
        const recalcTotal = Object.values(loadedFundInvestments).reduce((s, v) => s + v, 0);
        portfolioGlobals = {
            totalInvestment: recalcTotal > 0 ? recalcTotal : (data.globals?.totalInvestment || 0),
            totalSparrate:   data.globals?.totalSparrate || 0,
            fundInvestments: loadedFundInvestments,
            fundSparrates:   loadedFundSparrates
        };
        if (totalInvestmentInput) totalInvestmentInput.value = formatNumberInput(portfolioGlobals.totalInvestment);
        savePortfolio(); saveGlobals();
        updateFinancialOverview(); renderPanel();
        if (currentBlockData) { renderFundList(currentBlockData.funds); refreshModalButtons(); }
    }

    // ── Haupt-Upload-Handler ──────────────────────────────────
    if (depotUploadInput) {
        depotUploadInput.addEventListener('change', async e => {
            const file = e.target.files[0]; if (!file) return;
            const ext  = file.name.split('.').pop().toLowerCase();

            if (depotLabelText) depotLabelText.textContent = 'Wird verarbeitet…';
            if (depotUploadLabel) depotUploadLabel.classList.add('pdf-loading');

            const baseName = file.name.replace(/\.[^.]+$/, '').trim();

            try {
                const wknLookup = buildWknLookup();
                let matched = [], unmatched = [];

                if (ext === 'csv') {
                    const ab = await file.arrayBuffer();
                    let text = new TextDecoder('utf-8', { fatal: false }).decode(ab);
                    if (text.includes('\uFFFD')) text = new TextDecoder('windows-1252').decode(ab);
                    ({ matched, unmatched } = parseCsvDepot(text, wknLookup));
                } else if (ext === 'xlsx' || ext === 'xls') {
                    if (typeof XLSX === 'undefined') throw new Error('SheetJS nicht geladen. Internetverbindung prüfen.');
                    const ab = await file.arrayBuffer();
                    ({ matched, unmatched } = parseXlsxDepot(XLSX.read(ab, { type: 'array' }), wknLookup));
                } else if (ext === 'pdf') {
                    ({ matched, unmatched } = parsePdfData(await extractPdfText(file), wknLookup));
                } else {
                    throw new Error(`Dateiformat ".${ext}" nicht unterstützt.`);
                }

                if (depotUploadLabel) { depotUploadLabel.classList.remove('pdf-loading'); depotUploadLabel.classList.add('pdf-loaded'); }
                if (depotLabelText) depotLabelText.textContent = `✓ ${baseName.length > 18 ? baseName.slice(0,18)+'…' : baseName}`;

                showImportResult(matched, unmatched, baseName);

            } catch(err) {
                console.error('Import-Fehler:', err);
                if (depotUploadLabel) depotUploadLabel.classList.remove('pdf-loading');
                if (depotLabelText) depotLabelText.textContent = 'Depot laden (CSV / Excel)';
                alert(`Fehler beim Importieren:\n${err.message || err}`);
            }
            e.target.value = '';
        });
    }

    // ── INIT ─────────────────────────────────────────────────
    renderPanel();
    document.querySelectorAll('.tower-layer').forEach(el => el.classList.add('highlighted'));
    updateDetails(null);
});



