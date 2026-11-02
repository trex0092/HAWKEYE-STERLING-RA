  const lists = [], notes = [], failures = [];
  const licence = licenceFreeFilter(sources);
  if (licence.skipped.length) {
    sources = licence.kept;
    notes.push('Licence-free mode (OPENSANCTIONS_DATA=0): ' + licence.skipped.length
      + ' OpenSanctions-hosted source(s) not screened - ' + licence.skipped.map(x => x.id).join(', '));
    console.warn('sanctions-screen: licence-free mode - skipped ' + licence.skipped.map(x => x.id).join(', '));
  }
  let fetched = 0;
  const sourceLimit = Math.min(6, Math.max(1, sources.length || 1));
  const sourceResults = await mapLimit(sources, sourceLimit, async (s) => {
    try {
      const body = await fetchListBody(s, Number(s.timeoutMs) || cfg.listTimeoutMs);
      const parsed = parseList(s, body);
      const junk = screenableNames(parsed);
      if (junk.drifted) {
        return {
          ok: false,
          failure: {
            source: s,
            reason: 'format drift - ' + junk.dropped + ' of ' + parsed.length
              + ' parsed value(s) are not names (dates / serials / schedule references)'
          },
          note: 'format drift - ' + junk.dropped + ' of ' + parsed.length
            + ' parsed value(s) are not names (dates / serials / schedule references)'
        };
      }
      if (junk.dropped) console.warn('sanctions-screen: ' + s.id + ' dropped ' + junk.dropped + ' non-name value(s)');
      const names = junk.kept;
      if (!names.length) {
        if (s.optional) {
          return {
            ok: true,
            fetched: true,
            list: null,
            note: s.name + ' has no entries - optional internal list, coverage unaffected'
          };
        }
        return {
          ok: false,
          failure: { source: s, reason: 'parsed 0 names' },
          note: 'parsed 0 names'
        };
      }
      if (belowFloor(s, names)) {
        return {
          ok: true,
          partial: true,
          list: { id: s.id, name: s.name, names, partial: true, sourceUrl: s.url || s.file || '', jurisdiction: s.jurisdiction || '' },
          failure: {
            source: s,
            reason: 'parsed ' + names.length + ' name(s), below its ' + s.minNames + ' coverage floor - truncated source'
          },
          note: 'parsed ' + names.length + ' name(s), below its ' + s.minNames + ' coverage floor - truncated source'
        };
      }
      return {
        ok: true,
        fetched: true,
        list: { id: s.id, name: s.name, names, sourceUrl: s.url || s.file || '', jurisdiction: s.jurisdiction || '' },
      };
    } catch (e) {
      const hint = (s.tokenEnv && /sign-in|login page/.test(describeFetchError(e)) && !process.env[s.tokenEnv])
        ? ' - this source now needs a personal download token: set the ' + s.tokenEnv + ' repository secret'
        : '';
      return {
        ok: false,
        failure: {
          source: s,
          reason: 'could not be loaded (' + describeFetchError(e) + ')' + hint
        },
        note: 'could not be loaded (' + describeFetchError(e) + ')' + hint
      };
    }
  });

  for (const res of sourceResults) {
    if (!res) continue;
    if (res.ok === false) {
      const failure = res.failure || { source: null, reason: res.note || 'unknown source failure' };
      failures.push(failure);
      const s = failure.source || {};
      if (failure.reason) {
        console.error('sanctions-screen: ' + (s.id || 'source') + ' failed - ' + failure.reason);
      }
      if (res.note) {
        notes.push(s.name + ' ' + res.note + ' - coverage degraded');
      }
      continue;
    }
    if (res.note) {
      notes.push(res.note);
      console.warn('sanctions-screen: ' + res.note);
    }
    if (res.list) {
      lists.push(res.list);
      fetched++;
      if (res.list.partial) {
        failures.push({
          source: { id: res.list.id, name: res.list.name },
          reason: 'parsed ' + res.list.names.length + ' name(s), below its coverage floor - truncated source'
        });
      } else {
        console.log('sanctions-screen: loaded ' + res.list.name + ' (' + res.list.names.length + ' designated names)');
      }
    } else if (res.fetched) {
      fetched++;
    }
  }

  const fold = foldAliasSources(lists, sources);
  for (const f of fold.folded) console.log('sanctions-screen: ' + f);
  for (const n of fold.notes) { notes.push(n); console.error('sanctions-screen: ' + n); }

  const fullyLoaded = new Set(lists.filter(l => !l.partial).map(l => l.id));
  const unresolved = [];
  for (const failure of failures) {
    const s = failure.source || {};
    const fallback = String(s.fallbackSourceId || '');
    if (fallback && fullyLoaded.has(fallback)) {
      notes.push(s.name + ' ' + failure.reason + ' - fallback ' + fallback + ' loaded successfully; coverage preserved');
      console.warn('sanctions-screen: ' + s.id + ' unavailable, but fallback ' + fallback + ' is loaded - coverage preserved');
    } else {
      unresolved.push(failure);
      notes.push(s.name + ' ' + failure.reason + ' - coverage degraded');
    }
  }

  return {
    lists,
    degraded: unresolved.length > 0 || fold.notes.length > 0,
    fetched,
    total: sources.length,
    notes,
    unresolvedSources: unresolved.map(x => x.source && x.source.id).filter(Boolean),
  };
