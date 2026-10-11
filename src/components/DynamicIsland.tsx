import { useState, useMemo, useRef, useEffect } from 'react';
import type { Point } from '../lib/router';
import { searchPlaces, getPlaceCategoryIcon, getPlaceCategoryLabel, type Place } from '../lib/places';
import type { TransitStop as Stop } from '../lib/navigation';

const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export type IslandState = 1 | 2 | 3;

interface DynamicIslandProps {
  originLabel: string;
  destinationLabel: string;
  pickOrigin?: boolean;
  pickDestination?: boolean;
  places: Place[];
  stops: Stop[];
  onSelect: (point: Point, name: string, place?: Place, target?: 'origin' | 'destination') => void;
  onPickOnMap: (target: 'origin' | 'destination') => void;
  onUseCurrentOrigin?: () => void;
  editLocating?: boolean;
  onSwap?: () => void;
  canSwap?: boolean;
  onBack: () => void;
}

export default function DynamicIsland({
  originLabel,
  destinationLabel,
  pickOrigin,
  pickDestination,
  places,
  stops,
  onSelect,
  onPickOnMap,
  onUseCurrentOrigin,
  editLocating,
  onSwap,
  canSwap,
  onBack,
}: DynamicIslandProps) {
  // State 1 = Pill (dots only), State 2 = Two lines (default open), State 3 = Search popup
  const [islandState, setIslandState] = useState<IslandState>(2);
  const [searchTarget, setSearchTarget] = useState<'origin' | 'destination' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionFeedback, setSelectionFeedback] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Schedule auto-transition from State 2 -> State 1 after 4 seconds
  const scheduleState2ToState1 = () => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      setIslandState(1);
    }, 4000);
  };

  // On initial mount in State 2: wait 4 seconds and smoothly collapse to State 1
  useEffect(() => {
    scheduleState2ToState1();
    return () => clearTimer();
  }, []);

  // When opening State 3: auto-focus input
  useEffect(() => {
    if (islandState === 3 && searchTarget) {
      setSearchQuery('');
      setSelectionFeedback(null);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [islandState, searchTarget]);

  // Suggestions for places and stops
  const filteredPlaces = useMemo(() => {
    if (islandState !== 3) return [];
    return searchPlaces(places, searchQuery, 5);
  }, [places, searchQuery, islandState]);

  const filteredStops = useMemo(() => {
    if (islandState !== 3) return [];
    const term = normalize(searchQuery.trim());
    if (term.length < 2) return [];
    const seen = new Set<string>();
    return stops.filter(stop => {
      if (!normalize(stop.name).includes(term) || seen.has(stop.name)) return false;
      seen.add(stop.name);
      return true;
    }).slice(0, Math.max(0, 7 - filteredPlaces.length));
  }, [stops, searchQuery, filteredPlaces.length, islandState]);

  // Handle transition when user picks a destination/origin:
  // 1. Shows confirmation in State 3 for 4 seconds
  // 2. Returns to State 2
  // 3. Stays in State 2 for 4 seconds, then collapses to State 1
  const handleSelectionSuccess = (name: string) => {
    clearTimer();
    setSelectionFeedback(name);

    // Wait 4 seconds in State 3 showing the selected destination, then go to State 2
    timerRef.current = setTimeout(() => {
      setSelectionFeedback(null);
      setSearchTarget(null);
      setIslandState(2);

      // In State 2, wait another 4 seconds and collapse to State 1
      scheduleState2ToState1();
    }, 4000);
  };

  // Manual skip to State 2 if user clicks on the feedback badge
  const handleSkipToState2 = () => {
    clearTimer();
    setSelectionFeedback(null);
    setSearchTarget(null);
    setIslandState(2);
    scheduleState2ToState1();
  };

  const handleSelectPlace = (place: Place) => {
    if (!searchTarget) return;
    onSelect(place.coordinates, place.name, place, searchTarget);
    handleSelectionSuccess(place.name);
  };

  const handleSelectStop = (stop: Stop) => {
    if (!searchTarget) return;
    onSelect(stop.coordinates, stop.name, undefined, searchTarget);
    handleSelectionSuccess(stop.name);
  };

  const handlePickMap = () => {
    if (!searchTarget) return;
    onPickOnMap(searchTarget);
    clearTimer();
    setSearchTarget(null);
    setSelectionFeedback(null);
    setIslandState(2);
    scheduleState2ToState1();
  };

  const handleCloseSearch = () => {
    clearTimer();
    setSearchTarget(null);
    setSelectionFeedback(null);
    setIslandState(2);
    scheduleState2ToState1();
  };

  const handleOpenSearch = (target: 'origin' | 'destination') => {
    clearTimer();
    setSearchTarget(target);
    setIslandState(3);
  };

  const handleTapPill = () => {
    clearTimer();
    setIslandState(2);
    scheduleState2ToState1();
  };

  const handleManualCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearTimer();
    setIslandState(1);
  };

  const handleSwap = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSwap) onSwap();
    scheduleState2ToState1();
  };

  /* ─────────────────────────────────────────────────────────────────────── */
  /* ── ESTADO 1: PÍLDORA MÍNIMA (Solo los puntos ⚪ → 🟠)                  ── */
  /* ─────────────────────────────────────────────────────────────────────── */
  if (islandState === 1) {
    return (
      <div
        className="dynamic-island dynamic-island--collapsed"
        onClick={handleTapPill}
        role="button"
        tabIndex={0}
        aria-label="Toca para ver origen y destino"
      >
        <span className="di-dot di-dot--origin" />
        <span className="di-arrow">→</span>
        <span className="di-dot di-dot--destination" />
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────── */
  /* ── ESTADO 3: BUSCADOR INTEGRADO (Desplegado al tocar origen/destino)  ── */
  /* ─────────────────────────────────────────────────────────────────────── */
  if (islandState === 3 && searchTarget) {
    const isOrigin = searchTarget === 'origin';
    return (
      <div className="dynamic-island dynamic-island--search" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="di-search-header">
          <div className="di-search-title">
            <span className={`di-dot ${isOrigin ? 'di-dot--origin' : 'di-dot--destination'}`} />
            <span>{isOrigin ? '¿Desde dónde sales?' : '¿A dónde vas?'}</span>
          </div>
          <button className="di-close-btn" onClick={handleCloseSearch} aria-label="Cerrar">✕</button>
        </div>

        {/* Feedback Badge if selected: countdown indicator */}
        {selectionFeedback ? (
          <div
            className="di-feedback-banner"
            onClick={handleSkipToState2}
            title="Toca para continuar de inmediato"
          >
            <div className="di-feedback-icon">✓</div>
            <div className="di-feedback-content">
              <strong>{isOrigin ? 'Origen establecido' : 'Destino seleccionado'}</strong>
              <span className="truncate">{selectionFeedback}</span>
            </div>
            <div className="di-feedback-timer" aria-hidden="true">
              <span className="di-timer-dot" />
            </div>
          </div>
        ) : (
          <>
            {/* Input Field */}
            <div className="di-input-wrap">
              <span className="di-input-icon">🔍</span>
              <input
                ref={inputRef}
                type="text"
                className="di-search-input"
                placeholder={isOrigin ? 'Escribe tu punto de partida...' : 'Escribe tu destino o lugar...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="di-clear-btn" onClick={() => setSearchQuery('')} aria-label="Limpiar">
                  ✕
                </button>
              )}
            </div>

            {/* Quick Actions */}
            <div className="di-quick-actions">
              {isOrigin && onUseCurrentOrigin && (
                <button
                  type="button"
                  className="di-action-btn di-action-btn--gps"
                  disabled={editLocating}
                  onClick={() => {
                    onUseCurrentOrigin();
                    handleSelectionSuccess('Mi ubicación actual');
                  }}
                >
                  <span>⌖</span>
                  <span>{editLocating ? 'Buscando GPS…' : 'Mi ubicación actual'}</span>
                </button>
              )}
              <button type="button" className="di-action-btn di-action-btn--map" onClick={handlePickMap}>
                <span>📍</span>
                <span>Presionar en el mapa</span>
              </button>
            </div>

            {/* Results List */}
            <div className="di-results-list">
              {filteredPlaces.map(place => (
                <button
                  key={`place-${place.id}`}
                  type="button"
                  className="di-result-item"
                  onClick={() => handleSelectPlace(place)}
                >
                  <span className="di-item-icon">{getPlaceCategoryIcon(place)}</span>
                  <div className="di-item-text">
                    <strong>{place.name}</strong>
                    <small>{place.neighborhood || place.municipality || getPlaceCategoryLabel(place.category)}{place.status !== 'verificado' ? ' · Por verificar' : ''}</small>
                  </div>
                </button>
              ))}

              {filteredStops.map(stop => (
                <button
                  key={`stop-${stop.id}`}
                  type="button"
                  className="di-result-item"
                  onClick={() => handleSelectStop(stop)}
                >
                  <span className="di-item-icon">🚏</span>
                  <div className="di-item-text">
                    <strong>{stop.name}</strong>
                    <small>Parada de transporte</small>
                  </div>
                </button>
              ))}

              {searchQuery.trim().length >= 2 && !filteredPlaces.length && !filteredStops.length && (
                <div className="di-no-results">
                  <p>No encontramos "{searchQuery}".</p>
                  <button type="button" className="di-map-fallback" onClick={handlePickMap}>
                    📍 Seleccionar este punto en el mapa
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────── */
  /* ── ESTADO 2: DOS LÍNEAS (⚪ DESDE ... / 🟠 HASTA ...)                 ── */
  /* ─────────────────────────────────────────────────────────────────────── */
  const originText = pickOrigin ? 'Toca el mapa…' : originLabel;
  const destText = pickDestination ? 'Toca el mapa…' : (destinationLabel || 'Elegir destino');

  return (
    <div
      className="dynamic-island dynamic-island--twolines"
      onMouseEnter={scheduleState2ToState1}
      onTouchStart={scheduleState2ToState1}
    >
      {/* Back button */}
      <button className="di-back" onClick={onBack} aria-label="Volver">
        ←
      </button>

      {/* 2 Rows: Origen and Destino */}
      <div className="di-rows">
        {/* Row 1: Origen */}
        <button
          className="di-row-btn"
          onClick={() => handleOpenSearch('origin')}
          aria-label="Cambiar origen"
        >
          <span className="di-dot di-dot--origin" />
          <span className="di-row-label">
            <span className="di-row-tag">Desde</span>
            <strong className="di-row-value">{originText}</strong>
          </span>
        </button>

        <div className="di-row-divider" />

        {/* Row 2: Destino */}
        <button
          className="di-row-btn di-row-btn--dest"
          onClick={() => handleOpenSearch('destination')}
          aria-label="Cambiar destino"
        >
          <span className="di-dot di-dot--destination" />
          <span className="di-row-label">
            <span className="di-row-tag">Hasta</span>
            <strong className="di-row-value di-row-value--dest">{destText}</strong>
          </span>
        </button>
      </div>

      {/* Right controls: Swap & Collapse */}
      <div className="di-controls">
        {canSwap && onSwap && (
          <button className="di-ctrl-btn" onClick={handleSwap} aria-label="Invertir origen y destino">
            ⇅
          </button>
        )}
        <button className="di-ctrl-btn" onClick={handleManualCollapse} aria-label="Colapsar a píldora">
          ↑
        </button>
      </div>
    </div>
  );
}
