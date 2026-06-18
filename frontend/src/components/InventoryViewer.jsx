import { useEffect, useState } from 'react';
import axios from 'axios';

const GAMES = [
  { id: '753', context: '6', name: 'Steam Community' },
  { id: '730', context: '2', name: 'Counter-Strike 2' },
  { id: '440', context: '2', name: 'Team Fortress 2' },
  { id: '570', context: '2', name: 'Dota 2' },
  { id: '252490', context: '2', name: 'Rust' },
];

const CDN_BASE = 'https://steamcommunity-a.akamaihd.net/economy/image/';

function InventoryViewer({ player, comparedPlayer }) {
  const [selectedGame, setSelectedGame] = useState(GAMES[0]);
  const [prices, setPrices] = useState(() => {
    try {
      const cached = localStorage.getItem('steam_item_prices');
      if (cached) {
        const parsed = JSON.parse(cached);
        const now = Date.now();
        const fresh = {};
        let hasFresh = false;
        Object.entries(parsed).forEach(([key, val]) => {
          // Cache prices client-side for 30 minutes
          if (val && now - val.cachedAt < 30 * 60 * 1000) {
            fresh[key] = val;
            hasFresh = true;
          }
        });
        if (hasFresh) return fresh;
      }
    } catch (e) {
      console.error('Failed to parse cached prices:', e);
    }
    return {};
  });

  const [requestTimestamps, setRequestTimestamps] = useState(() => {
    try {
      const cached = localStorage.getItem('steam_request_timestamps');
      if (cached) {
        const parsed = JSON.parse(cached);
        const now = Date.now();
        return parsed.filter(t => now - t < 60 * 1000);
      }
    } catch {}
    return [];
  });
  const [cooldownTime, setCooldownTime] = useState(0);

  // Cooldown countdown timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      
      setRequestTimestamps(prev => {
        const filtered = prev.filter(t => now - t < 60 * 1000);
        try {
          localStorage.setItem('steam_request_timestamps', JSON.stringify(filtered));
        } catch {}
        
        if (filtered.length >= 20) {
          const oldest = filtered[0];
          const remaining = Math.ceil((60 * 1000 - (now - oldest)) / 1000);
          setCooldownTime(remaining > 0 ? remaining : 0);
        } else {
          setCooldownTime(0);
        }
        
        return filtered;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);
  
  const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5000';

  const fetchPrice = async (marketHashName, appid) => {
    const now = Date.now();
    let currentTimestamps = [];
    setRequestTimestamps(prev => {
      const filtered = prev.filter(t => now - t < 60 * 1000);
      currentTimestamps = filtered;
      return filtered;
    });

    if (currentTimestamps.length >= 20) {
      const oldest = currentTimestamps[0];
      const remaining = Math.ceil((60 * 1000 - (now - oldest)) / 1000);
      setCooldownTime(remaining);
      return;
    }

    setRequestTimestamps(prev => {
      const updated = [...prev, now];
      try {
        localStorage.setItem('steam_request_timestamps', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setPrices(prev => ({
      ...prev,
      [marketHashName]: { ...prev[marketHashName], loading: true }
    }));
    try {
      const res = await axios.get(`${API_BASE}/api/market/price?appid=${appid}&market_hash_name=${encodeURIComponent(marketHashName)}`);
      setPrices(prev => {
        const updated = {
          ...prev,
          [marketHashName]: {
            loading: false,
            lowest: res.data.lowest_price || res.data.median_price || 'N/A',
            median: res.data.median_price || 'N/A',
            cachedAt: Date.now()
          }
        };
        try {
          localStorage.setItem('steam_item_prices', JSON.stringify(updated));
        } catch (e) {
          console.error('Failed to save price to cache:', e);
        }
        return updated;
      });
    } catch (err) {
      setPrices(prev => {
        const updated = {
          ...prev,
          [marketHashName]: {
            loading: false,
            error: err.response?.data?.error || 'Error',
            cachedAt: Date.now()
          }
        };
        return updated;
      });
    }
  };

  const [inv1, setInv1] = useState(null);
  const [loading1, setLoading1] = useState(false);
  const [error1, setError1] = useState('');

  const [inv2, setInv2] = useState(null);
  const [loading2, setLoading2] = useState(false);
  const [error2, setError2] = useState('');

  // Primary player search/pagination/category states
  const [search1, setSearch1] = useState('');
  const [category1, setCategory1] = useState('All');
  const [page1, setPage1] = useState(1);

  // Compared player search/pagination/category states
  const [search2, setSearch2] = useState('');
  const [category2, setCategory2] = useState('All');
  const [page2, setPage2] = useState(1);

  const [compareTab, setCompareTab] = useState('summary'); // 'summary' | 'overlap' | 'exclusive'
  const [pageSize1, setPageSize1] = useState(32);
  const [pageSize2, setPageSize2] = useState(32);

  const [sortBy1, setSortBy1] = useState('default');
  const [marketFilter1, setMarketFilter1] = useState('all');
  const [tradeFilter1, setTradeFilter1] = useState('all');

  const [sortBy2, setSortBy2] = useState('default');
  const [marketFilter2, setMarketFilter2] = useState('all');
  const [tradeFilter2, setTradeFilter2] = useState('all');

  // ─── Fetch Primary Player Inventory ─────────────────────────────────────────
  useEffect(() => {
    if (!player?.steamid) {
      setInv1(null);
      return;
    }

    const fetchPrimaryInventory = async () => {
      setLoading1(true);
      setError1('');
      setPage1(1);
      setCategory1('All');
      try {
        const res = await axios.get(
          `${API_BASE}/api/inventory/${player.steamid}?appid=${selectedGame.id}&contextid=${selectedGame.context}`
        );
        setInv1(res.data);
      } catch (err) {
        setError1(err.response?.data?.error || 'Failed to load player inventory.');
        setInv1(null);
      } finally {
        setLoading1(false);
      }
    };

    fetchPrimaryInventory();
  }, [player?.steamid, selectedGame, API_BASE]);

  // ─── Fetch Compared Player Inventory ───────────────────────────────────────
  useEffect(() => {
    if (!comparedPlayer?.steamid) {
      setInv2(null);
      return;
    }

    const fetchComparedInventory = async () => {
      setLoading2(true);
      setError2('');
      setPage2(1);
      setCategory2('All');
      try {
        const res = await axios.get(
          `${API_BASE}/api/inventory/${comparedPlayer.steamid}?appid=${selectedGame.id}&contextid=${selectedGame.context}`
        );
        setInv2(res.data);
      } catch (err) {
        setError2(err.response?.data?.error || 'Failed to load compared profile inventory.');
        setInv2(null);
      } finally {
        setLoading2(false);
      }
    };

    fetchComparedInventory();
  }, [comparedPlayer?.steamid, selectedGame, API_BASE]);

  // Helper to parse inventory JSON and return grouped/normalized items
  const getProcessedItems = (invData) => {
    if (!invData || !invData.assets) return [];
    
    const descMap = {};
    if (invData.descriptions) {
      invData.descriptions.forEach((desc) => {
        const key = `${desc.classid}_${desc.instanceid || '0'}`;
        descMap[key] = desc;
      });
    }

    const grouped = {};
    invData.assets.forEach((asset) => {
      const key = `${asset.classid}_${asset.instanceid || '0'}`;
      const desc = descMap[key];
      if (desc) {
        const amount = parseInt(asset.amount || '1', 10);
        if (grouped[key]) {
          grouped[key].amount += amount;
        } else {
          grouped[key] = {
            ...desc,
            amount,
            key,
          };
        }
      }
    });

    return Object.values(grouped);
  };

  const items1 = getProcessedItems(inv1);
  const items2 = getProcessedItems(inv2);

  // Helper to get item category/type from tags
  const getItemType = (item) => {
    if (item.tags) {
      const typeTag = item.tags.find(
        (t) =>
          t.localized_category_name === 'Item Type' ||
          t.category === 'item_class' ||
          t.localized_category_name === 'Type'
      );
      if (typeTag) return typeTag.localized_tag_name;
    }
    return item.type || 'Other';
  };

  // Extract unique categories from items
  const getCategories = (items) => {
    const cats = new Set(['All']);
    items.forEach((item) => {
      cats.add(getItemType(item));
    });
    return Array.from(cats);
  };

  const cats1 = getCategories(items1);
  const cats2 = getCategories(items2);

  // Apply filtering (search, category, marketable, tradable)
  const getFilteredItems = (items, search, activeCat, marketFilter, tradeFilter) => {
    return items.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCat === 'All' || getItemType(item) === activeCat;
      const matchesMarket = 
        marketFilter === 'all' || 
        (marketFilter === 'marketable' && item.marketable === 1) ||
        (marketFilter === 'unmarketable' && item.marketable !== 1);
      const matchesTrade = 
        tradeFilter === 'all' || 
        (tradeFilter === 'tradable' && item.tradable === 1) ||
        (tradeFilter === 'untradable' && item.tradable !== 1);
      return matchesSearch && matchesCategory && matchesMarket && matchesTrade;
    });
  };

  const parsePrice = (priceStr) => {
    if (!priceStr || priceStr === 'N/A') return -1;
    const cleaned = priceStr.replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || -1;
  };

  const getSortedItems = (items, sortBy) => {
    const list = [...items];
    if (sortBy === 'name-asc') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'name-desc') {
      list.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortBy === 'qty-desc') {
      list.sort((a, b) => b.amount - a.amount);
    } else if (sortBy === 'qty-asc') {
      list.sort((a, b) => a.amount - b.amount);
    } else if (sortBy === 'price-desc' || sortBy === 'price-asc') {
      list.sort((a, b) => {
        const infoA = prices[a.market_hash_name];
        const infoB = prices[b.market_hash_name];
        const priceA = infoA && infoA.lowest ? parsePrice(infoA.lowest) : -1;
        const priceB = infoB && infoB.lowest ? parsePrice(infoB.lowest) : -1;

        if (priceA === -1 && priceB === -1) return 0;
        if (priceA === -1) return 1; // Put unpriced items at the end
        if (priceB === -1) return -1;

        return sortBy === 'price-desc' ? priceB - priceA : priceA - priceB;
      });
    }
    return list;
  };

  const filtered1 = getFilteredItems(items1, search1, category1, marketFilter1, tradeFilter1);
  const sorted1 = getSortedItems(filtered1, sortBy1);

  const filtered2 = getFilteredItems(items2, search2, category2, marketFilter2, tradeFilter2);
  const sorted2 = getSortedItems(filtered2, sortBy2);

  // Pagination bounds
  const getPaginatedItems = (items, page, size) => {
    const start = (page - 1) * size;
    return items.slice(start, start + size);
  };

  const paginated1 = getPaginatedItems(sorted1, page1, pageSize1);
  const paginated2 = getPaginatedItems(sorted2, page2, pageSize2);

  const totalPages1 = Math.ceil(sorted1.length / pageSize1);
  const totalPages2 = Math.ceil(sorted2.length / pageSize2);

  useEffect(() => {
    if (cooldownTime > 0 || requestTimestamps.length >= 20) return;

    const visibleItems = [
      ...paginated1.filter(item => item.marketable === 1 && !prices[item.market_hash_name]),
      ...paginated2.filter(item => item.marketable === 1 && !prices[item.market_hash_name])
    ];

    if (visibleItems.length === 0) return;

    let active = true;

    const fetchSequentially = async () => {
      for (const item of visibleItems) {
        if (!active) break;
        
        let currentLen = 0;
        setRequestTimestamps(prev => {
          currentLen = prev.length;
          return prev;
        });
        if (currentLen >= 20) break;

        if (!prices[item.market_hash_name]) {
          await fetchPrice(item.market_hash_name, selectedGame.id);
          await new Promise(resolve => setTimeout(resolve, 350));
        }
      }
    };

    fetchSequentially();

    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginated1, paginated2, cooldownTime]);

  // ─── COMPARISON ANALYSIS ───────────────────────────────────────────────────
  // 1. Overlap (Common items) - Matched by market_name
  const getOverlapItems = () => {
    const overlap = [];
    items1.forEach((it1) => {
      const match = items2.find((it2) => it2.market_name === it1.market_name);
      if (match) {
        overlap.push({
          item: it1,
          amount1: it1.amount,
          amount2: match.amount,
        });
      }
    });
    return overlap;
  };

  // 2. Exclusive items (owned only by player 1 or player 2)
  const getExclusiveItems = (listA, listB) => {
    return listA.filter((itA) => !listB.some((itB) => itB.market_name === itA.market_name));
  };

  const overlapItems = getOverlapItems();
  const exclusive1 = getExclusiveItems(items1, items2);
  const exclusive2 = getExclusiveItems(items2, items1);

  const sortedExclusive1 = getSortedItems(getFilteredItems(exclusive1, search1, category1, marketFilter1, tradeFilter1), sortBy1);
  const sortedExclusive2 = getSortedItems(getFilteredItems(exclusive2, search2, category2, marketFilter2, tradeFilter2), sortBy2);

  // 3. Category Breakdown counts
  const getCategoryBreakdown = () => {
    const breakdown = {};
    items1.forEach((it) => {
      const type = getItemType(it);
      if (!breakdown[type]) breakdown[type] = { type, me: 0, them: 0 };
      breakdown[type].me += it.amount;
    });
    items2.forEach((it) => {
      const type = getItemType(it);
      if (!breakdown[type]) breakdown[type] = { type, me: 0, them: 0 };
      breakdown[type].them += it.amount;
    });
    return Object.values(breakdown).sort((a, b) => (b.me + b.them) - (a.me + a.them));
  };

  const breakdownStats = getCategoryBreakdown();

  // Helper to render inventory grid
  const renderInventoryGrid = (
    items, page, totalPages, setPage, 
    search, setSearch, 
    category, setCategory, categories, 
    marketFilter, setMarketFilter,
    tradeFilter, setTradeFilter,
    sortBy, setSortBy,
    title, pName, avatar, 
    pageSize, setPageSize
  ) => {
    return (
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          {avatar && (
            <img src={avatar} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)' }} />
          )}
          <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
            {title} <span style={{ color: 'var(--accent-color)', fontSize: '0.85rem', fontWeight: 500 }}>({items.length} unique stacks)</span>
          </h4>
        </div>

        {/* Filters and search */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder={`Search ${pName}'s items...`}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{
              flex: 2, minWidth: '150px', padding: '0.45rem 0.75rem', borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.6)',
              color: '#f8fafc', fontSize: '0.82rem'
            }}
          />
          {categories.length > 2 && (
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
              style={{
                flex: 1, minWidth: '100px', padding: '0.45rem 0.75rem', borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.6)',
                color: '#cbd5e1', fontSize: '0.82rem', cursor: 'pointer'
              }}
            >
              <option value="All">All Types</option>
              {categories.filter(c => c !== 'All').map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          )}
          <select
            value={marketFilter}
            onChange={(e) => { setMarketFilter(e.target.value); setPage(1); }}
            style={{
              flex: 1, minWidth: '100px', padding: '0.45rem 0.75rem', borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.6)',
              color: '#cbd5e1', fontSize: '0.82rem', cursor: 'pointer'
            }}
          >
            <option value="all">Marketable (All)</option>
            <option value="marketable">Marketable Only</option>
            <option value="unmarketable">Non-Marketable</option>
          </select>
          <select
            value={tradeFilter}
            onChange={(e) => { setTradeFilter(e.target.value); setPage(1); }}
            style={{
              flex: 1, minWidth: '100px', padding: '0.45rem 0.75rem', borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.6)',
              color: '#cbd5e1', fontSize: '0.82rem', cursor: 'pointer'
            }}
          >
            <option value="all">Tradable (All)</option>
            <option value="tradable">Tradable Only</option>
            <option value="untradable">Non-Tradable</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
            style={{
              flex: 1, minWidth: '120px', padding: '0.45rem 0.75rem', borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.6)',
              color: '#cbd5e1', fontSize: '0.82rem', cursor: 'pointer'
            }}
          >
            <option value="default">Sort: Default</option>
            <option value="name-asc">Name: A-Z</option>
            <option value="name-desc">Name: Z-A</option>
            <option value="qty-desc">Quantity: High-Low</option>
            <option value="qty-asc">Quantity: Low-High</option>
            <option value="price-desc">Price: High-Low</option>
            <option value="price-asc">Price: Low-High</option>
          </select>
        </div>

        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.85rem' }}>
            No items found matching the search/filter.
          </div>
        ) : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(95px, 1fr))',
              gap: '0.5rem',
              marginBottom: '1rem'
            }}>
              {getPaginatedItems(items, page, pageSize).map((item) => {
                const imgUrl = item.icon_url ? `${CDN_BASE}${item.icon_url}/96fx96f` : '';
                const type = getItemType(item);
                const color = item.name_color ? `#${item.name_color}` : '#e2e8f0';

                return (
                  <div
                    key={item.key}
                    className="item-card"
                    style={{
                      background: 'rgba(30,41,59,0.3)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '8px',
                      padding: '0.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      position: 'relative',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s, background 0.2s',
                    }}
                    title={`${item.name}\nType: ${type}`}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'rgba(2, 122, 255, 0.4)';
                      e.currentTarget.style.background = 'rgba(30, 41, 59, 0.6)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                      e.currentTarget.style.background = 'rgba(30,41,59,0.3)';
                    }}
                  >
                    {/* Amount Badge */}
                    {item.amount > 1 && (
                      <span style={{
                        position: 'absolute', top: '4px', right: '4px',
                        background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.1)',
                        color: 'var(--accent-color)', fontSize: '0.7rem', fontWeight: 700,
                        padding: '1px 5px', borderRadius: '4px', zIndex: 1
                      }}>
                        x{item.amount}
                      </span>
                    )}

                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt=""
                        loading="lazy"
                        style={{
                          width: '60px', height: '60px', objectFit: 'contain',
                          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))', marginBottom: '0.4rem'
                        }}
                      />
                    ) : (
                      <div style={{ width: '60px', height: '60px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', marginBottom: '0.4rem' }} />
                    )}

                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      height: '2.1rem',
                      lineHeight: '1.05rem',
                      width: '100%'
                    }}>
                      {item.name}
                    </span>

                    {item.marketable === 1 && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!prices[item.market_hash_name] || prices[item.market_hash_name].error) {
                            fetchPrice(item.market_hash_name, selectedGame.id);
                          }
                        }}
                        style={{
                          marginTop: '0.35rem',
                          fontSize: '0.68rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: prices[item.market_hash_name]?.loading
                            ? 'rgba(255,255,255,0.08)'
                            : prices[item.market_hash_name]?.lowest
                              ? 'rgba(16,185,129,0.15)'
                              : 'rgba(255,255,255,0.05)',
                          color: prices[item.market_hash_name]?.lowest
                            ? '#34d399'
                            : prices[item.market_hash_name]?.error
                              ? '#f87171'
                              : '#94a3b8',
                          border: `1px solid ${
                            prices[item.market_hash_name]?.lowest
                              ? 'rgba(16,185,129,0.3)'
                              : prices[item.market_hash_name]?.error
                                ? 'rgba(239,68,68,0.3)'
                                : 'rgba(255,255,255,0.1)'
                          }`,
                          display: 'inline-block',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                        title={
                          prices[item.market_hash_name]?.lowest
                            ? `Lowest Price: ${prices[item.market_hash_name].lowest}\nMedian Price: ${prices[item.market_hash_name].median}\nClick to refresh`
                            : prices[item.market_hash_name]?.error
                              ? `Error: ${prices[item.market_hash_name].error}. Click to retry.`
                              : 'Click to fetch market price'
                        }
                      >
                        {prices[item.market_hash_name]?.loading ? '...' : prices[item.market_hash_name]?.lowest ? prices[item.market_hash_name].lowest : '$ Price'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <button
                  onClick={() => setPage(p => Math.max(p - 1, 1))}
                  disabled={page === 1}
                  className="tab-btn"
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', opacity: page === 1 ? 0.4 : 1, cursor: page === 1 ? 'not-allowed' : 'pointer' }}
                >
                  ◀ Prev
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Page {page} of {totalPages}
                  </span>
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                    style={{
                      padding: '0.2rem 0.4rem', borderRadius: '4px',
                      border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15,23,42,0.8)',
                      color: '#cbd5e1', fontSize: '0.7rem', cursor: 'pointer'
                    }}
                  >
                    <option value={16}>16 / page</option>
                    <option value={32}>32 / page</option>
                    <option value={64}>64 / page</option>
                    <option value={128}>128 / page</option>
                  </select>
                </div>
                <button
                  onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                  disabled={page === totalPages}
                  className="tab-btn"
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', opacity: page === totalPages ? 0.4 : 1, cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
                >
                  Next ▶
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* ── CARD 1: PRIMARY PLAYER INVENTORY ── */}
      <div className="glass-panel" style={{ margin: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Player Inventory</h3>
            <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0 }}>
              Browse and filter community items, trading cards, and skins.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem', fontSize: '0.75rem' }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: cooldownTime > 0 ? '#ef4444' : requestTimestamps.length >= 15 ? '#f59e0b' : '#10b981',
                boxShadow: cooldownTime > 0 ? '0 0 8px #ef4444' : 'none',
                display: 'inline-block',
                transition: 'background 0.3s ease'
              }} />
              <span style={{ color: cooldownTime > 0 ? '#f87171' : '#94a3b8', fontWeight: 600 }}>
                {cooldownTime > 0 
                  ? `Cooldown Active: Throttling requests. Resuming in ${cooldownTime}s` 
                  : `API rate-limit tracker: ${requestTimestamps.length} / 20 requests/min`}
              </span>
            </div>
          </div>

          {/* Game Selector TabBar inside card */}
          <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '2px' }}>
            {GAMES.map(game => (
              <button
                key={game.id}
                onClick={() => setSelectedGame(game)}
                className={`tab-btn${selectedGame.id === game.id ? ' active' : ''}`}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
              >
                {game.name}
              </button>
            ))}
          </div>
        </div>

        {loading1 ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Fetching inventory assets from Steam...</p>
          </div>
        ) : error1 ? (
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: '10px', padding: '1rem 1.25rem', color: '#f87171', fontSize: '0.85rem'
          }}>
            ⚠️ {error1}
          </div>
        ) : inv1 ? (
          renderInventoryGrid(
            sorted1,
            page1,
            totalPages1,
            setPage1,
            search1,
            setSearch1,
            category1,
            setCategory1,
            cats1,
            marketFilter1,
            setMarketFilter1,
            tradeFilter1,
            setTradeFilter1,
            sortBy1,
            setSortBy1,
            `${player?.persona_name || 'Your'} Inventory`,
            player?.persona_name || 'You',
            player?.avatar_url,
            pageSize1,
            setPageSize1
          )
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.88rem' }}>
            No inventory details available.
          </div>
        )}
      </div>

      {/* ── CARD 2: COMPARISON DASHBOARD (Only visible if compared player is active) ── */}
      {comparedPlayer && (
        <div className="glass-panel" style={{ margin: 0 }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Inventory Comparison</h3>
            <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0 }}>
              Head-to-head comparison and overlap metrics for {player?.persona_name || 'you'} vs {comparedPlayer.persona_name}.
            </p>
          </div>

          {/* Sub tabs for comparison modes */}
          <div className="tab-bar" style={{ marginBottom: '1.5rem' }}>
            <button
              onClick={() => setCompareTab('summary')}
              className={`tab-btn${compareTab === 'summary' ? ' active' : ''}`}
            >
              📊 Stats Comparison
            </button>
            <button
              onClick={() => setCompareTab('overlap')}
              className={`tab-btn${compareTab === 'overlap' ? ' active' : ''}`}
            >
              🔄 Shared Items ({overlapItems.length})
            </button>
            <button
              onClick={() => setCompareTab('exclusive')}
              className={`tab-btn${compareTab === 'exclusive' ? ' active' : ''}`}
            >
              ⭐ Exclusive Items
            </button>
          </div>

          {loading1 || loading2 ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Analyzing shared inventory data...</p>
            </div>
          ) : error2 ? (
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: '10px', padding: '1rem 1.25rem', color: '#f87171', fontSize: '0.85rem'
            }}>
              ⚠️ {error2}
            </div>
          ) : inv1 && inv2 ? (
            <div className="tab-content">
              {/* Tab 1: Stats & Distribution Breakdown */}
              {compareTab === 'summary' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  
                  {/* Quick stats grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div style={{ background: 'rgba(30,41,59,0.4)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <h5 style={{ margin: '0 0 0.5rem 0', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500 }}>Total Items (Stacked)</h5>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#3b82f6' }}>
                            {items1.reduce((acc, it) => acc + it.amount, 0)}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{player?.persona_name || 'You'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#f59e0b' }}>
                            {items2.reduce((acc, it) => acc + it.amount, 0)}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{comparedPlayer.persona_name}</div>
                        </div>
                      </div>
                    </div>

                    <div style={{ background: 'rgba(30,41,59,0.4)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <h5 style={{ margin: '0 0 0.5rem 0', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500 }}>Unique Items</h5>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#3b82f6' }}>{items1.length}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{player?.persona_name || 'You'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#f59e0b' }}>{items2.length}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{comparedPlayer.persona_name}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Type Distribution bars */}
                  <div>
                    <h4 style={{ margin: '0 0 0.8rem 0', fontSize: '1rem', color: '#e2e8f0' }}>Item Types Distribution</h4>
                    {breakdownStats.length === 0 ? (
                      <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No item type breakdown available.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        {breakdownStats.map((stat) => {
                          const total = Math.max(stat.me, stat.them);
                          const pct1 = total > 0 ? (stat.me / total) * 100 : 0;
                          const pct2 = total > 0 ? (stat.them / total) * 100 : 0;
                          
                          return (
                            <div key={stat.type} style={{ background: 'rgba(15,23,42,0.25)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem', color: '#cbd5e1' }}>
                                <span style={{ fontWeight: 600 }}>{stat.type}</span>
                                <span>
                                  <span style={{ color: '#3b82f6', fontWeight: 600 }}>{stat.me}</span>
                                  <span style={{ color: '#475569', margin: '0 4px' }}>vs</span>
                                  <span style={{ color: '#f59e0b', fontWeight: 600 }}>{stat.them}</span>
                                </span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {/* Player 1 progress bar */}
                                <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${pct1}%`, background: 'linear-gradient(90deg, #3b82f6, #60a5fa)', borderRadius: '3px', transition: 'width 0.6s ease' }} />
                                </div>
                                {/* Player 2 progress bar */}
                                <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${pct2}%`, background: 'linear-gradient(90deg, #f59e0b, #fbbf24)', borderRadius: '3px', transition: 'width 0.6s ease' }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Shared Items (Overlap) */}
              {compareTab === 'overlap' && (
                <div>
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 1rem 0' }}>
                    These are the items both profiles own in common. Great for trading duplicates!
                  </p>
                  {overlapItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.85rem' }}>
                      No common items found between these profiles for {selectedGame.name}.
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                      gap: '0.75rem'
                    }}>
                      {overlapItems.map(({ item, amount1, amount2 }) => {
                        const imgUrl = item.icon_url ? `${CDN_BASE}${item.icon_url}/96fx96f` : '';
                        const color = item.name_color ? `#${item.name_color}` : '#e2e8f0';
                        const type = getItemType(item);

                        return (
                          <div key={item.key} style={{
                            background: 'rgba(30,41,59,0.3)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            borderRadius: '10px',
                            padding: '0.75rem',
                            display: 'flex',
                            gap: '0.75rem',
                            alignItems: 'center'
                          }}>
                            {imgUrl ? (
                              <img src={imgUrl} alt="" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                            ) : (
                              <div style={{ width: '48px', height: '48px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }} />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <h5 style={{ margin: 0, fontSize: '0.82rem', color, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.name}
                              </h5>
                              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{type}</span>
                              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem', fontSize: '0.75rem' }}>
                                <span style={{ color: '#60a5fa' }}>{player?.persona_name || 'You'}: <strong>{amount1}</strong></span>
                                <span style={{ color: '#fbbf24' }}>{comparedPlayer.persona_name}: <strong>{amount2}</strong></span>
                              </div>
                            </div>

                            {item.marketable === 1 && (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!prices[item.market_hash_name] || prices[item.market_hash_name].error) {
                                    fetchPrice(item.market_hash_name, selectedGame.id);
                                  }
                                }}
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  background: prices[item.market_hash_name]?.loading
                                    ? 'rgba(255,255,255,0.08)'
                                    : prices[item.market_hash_name]?.lowest
                                      ? 'rgba(16,185,129,0.15)'
                                      : 'rgba(255,255,255,0.05)',
                                  color: prices[item.market_hash_name]?.lowest
                                    ? '#34d399'
                                    : prices[item.market_hash_name]?.error
                                      ? '#f87171'
                                      : '#94a3b8',
                                  border: `1px solid ${
                                    prices[item.market_hash_name]?.lowest
                                      ? 'rgba(16,185,129,0.3)'
                                      : prices[item.market_hash_name]?.error
                                        ? 'rgba(239,68,68,0.3)'
                                        : 'rgba(255,255,255,0.1)'
                                  }`,
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap'
                                }}
                                title={
                                  prices[item.market_hash_name]?.lowest
                                    ? `Lowest Price: ${prices[item.market_hash_name].lowest}\nMedian Price: ${prices[item.market_hash_name].median}\nClick to refresh`
                                    : prices[item.market_hash_name]?.error
                                      ? `Error: ${prices[item.market_hash_name].error}. Click to retry.`
                                      : 'Click to fetch market price'
                                }
                              >
                                {prices[item.market_hash_name]?.loading ? '...' : prices[item.market_hash_name]?.lowest ? prices[item.market_hash_name].lowest : '$ Price'}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Exclusive Items (Only one player owns) */}
              {compareTab === 'exclusive' && (
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                  
                  {/* Left Column: Only Player 1 */}
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    {renderInventoryGrid(
                      sortedExclusive1,
                      page1, // reuse page/pagination locally in rendering helper
                      Math.ceil(sortedExclusive1.length / pageSize1),
                      setPage1,
                      search1,
                      setSearch1,
                      category1,
                      setCategory1,
                      cats1,
                      marketFilter1,
                      setMarketFilter1,
                      tradeFilter1,
                      setTradeFilter1,
                      sortBy1,
                      setSortBy1,
                      `Only ${player?.persona_name || 'You'}`,
                      player?.persona_name || 'You',
                      player?.avatar_url,
                      pageSize1,
                      setPageSize1
                    )}
                  </div>

                  {/* Right Column: Only Player 2 */}
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    {renderInventoryGrid(
                      sortedExclusive2,
                      page2,
                      Math.ceil(sortedExclusive2.length / pageSize2),
                      setPage2,
                      search2,
                      setSearch2,
                      category2,
                      setCategory2,
                      cats2,
                      marketFilter2,
                      setMarketFilter2,
                      tradeFilter2,
                      setTradeFilter2,
                      sortBy2,
                      setSortBy2,
                      `Only ${comparedPlayer.persona_name}`,
                      comparedPlayer.persona_name,
                      comparedPlayer.avatar_url,
                      pageSize2,
                      setPageSize2
                    )}
                  </div>

                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.88rem' }}>
              Add a second profile and load inventory to compare.
            </div>
          )}
        </div>
      )}

    </div>
  );
}

export default InventoryViewer;
