'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/lib/firebase/auth';
import { getPlacesByCellIds } from '@/lib/firebase/places';
import NaverMapView, { MapBounds } from '@/components/map/NaverMapView';
import PlaceBottomSheet from '@/components/map/PlaceBottomSheet';
import SearchBar, { SearchResultItem } from '@/components/map/SearchBar';
import { getCellIdsForBounds } from '@/lib/utils/cellId';
import { Place, FilterState } from '@/types';
import HallOfFamePreview from '@/components/HallOfFamePreview';

const MAP_STATE_STORAGE_KEY = 'donggo_map_state';
const CLUSTER_MAX_ZOOM = 14; // ???????????꾩룆梨띰쭕???????????????????獄쏅챶留????硫명떈????????
function isPlaceInBounds(place: Place, bounds: MapBounds): boolean {
  return (
    place.lat >= bounds.sw.lat &&
    place.lat <= bounds.ne.lat &&
    place.lng >= bounds.sw.lng &&
    place.lng <= bounds.ne.lng
  );
}

export default function HomePage() {
  const router = useRouter();
  const { firebaseUser, user, loading } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [allPlaces, setAllPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [filterState, setFilterState] = useState<FilterState>({
    isActive: false,
    activeCount: 0,
  });
  const [currentBounds, setCurrentBounds] = useState<MapBounds | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(12);

  // ????븐뼐??????????????椰????(?? ??????ш끽踰椰?????袁ㅻ쇀????????亦껋꼦維????
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 37.5665, lng: 126.978 });
  const [mapZoom, setMapZoom] = useState<number>(12);

  // ??癲됱빖???嶺??????????椰????
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>();
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTotal, setSearchTotal] = useState<number>();
  const pendingSelectRef = useRef<string | null>(null);

  // ??????????濚밸Ŧ援????????? ???? ???????????ｋ젒???placeId???????????딅??嶺????????? ???????繹먮굞???
  const loadedPlaceIdsRef = useRef<Set<string>>(new Set());
  // ???? ????????cellId ??????熬곣몿????
  const loadedCellIdsRef = useRef<Set<string>>(new Set());
  // ??????嶺뚮∥????????????沃섃뫚???????????袁⑸즴筌?씛彛???????? ??????熬곣몿????
  const hasInitialLoadedRef = useRef(false);
  // ??????袁⑸즴筌?씛彛?????????????????ｋ젒????????袁⑸즴筌?씛彛?????
  const allPlacesLoadedRef = useRef(false);
  const allPlacesLoadingRef = useRef(false);
  const loadingCellIdsRef = useRef<Set<string>>(new Set());
  // ????븐뼐????????????????????熬곣몿?????????????꾩룆梨띰쭕??????????????뀀???살꽏?????key
  const [mapKey, setMapKey] = useState(0);

  const highlightedPlaceId = hoveredPlaceId ?? selectedPlace?.placeId ?? null;
  const showVisiblePlacesPanel = currentZoom > CLUSTER_MAX_ZOOM && currentBounds !== null;

  const visiblePlaces = useMemo(() => {
    if (!showVisiblePlacesPanel || !currentBounds) return [];

    return places
      .filter((place) => isPlaceInBounds(place, currentBounds))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [places, currentBounds, showVisiblePlacesPanel]);

  // ??????⑤슢堉??곕???????????? ???????????ｋ젒???????????蹂㏓??嶺뚮㉡???????????븐뼐??????????????椰??????????⑤벡瑜??꿔꺂??????
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedState = sessionStorage.getItem(MAP_STATE_STORAGE_KEY);
    if (savedState) {
      try {
        const { center, zoom } = JSON.parse(savedState);
        if (center?.lat && center?.lng && zoom) {
          console.log('[HomePage] ????븐뼐??????????????椰??????????⑤벡瑜??꿔꺂??????', { center, zoom });
          setMapCenter(center);
          setMapZoom(zoom);
          // ??????⑤벡瑜??꿔꺂???????????????????嶺뚮∥????????????沃섃뫚?????????????????????類ㅻ첐?? ??????醫딇떍??????耀붾굝?????????????????????????????ル?????
          hasInitialLoadedRef.current = false;
          // ????븐뼐????????????????????熬곣몿???????????ル??????????????源낆쭍????????????꾩룆梨띰쭕?????耀붾굝??????????????嶺뚮∥????????????雅?퍔瑗?땟???????????
          setMapKey(prev => prev + 1);
        }
      } catch (error) {
        console.error('????븐뼐??????????????椰??????????⑤벡瑜??꿔꺂???????????????곕츧??', error);
      }
    }
  }, []);

  // ???????????獄쏅챶留????硫명떈???????????????袁⑸즴筌?씛彛?????????????????ｋ젒??
  const loadAllPlaces = useCallback(async () => {
    if (allPlacesLoadedRef.current || allPlacesLoadingRef.current) {
      return;
    }

    allPlacesLoadingRef.current = true;
    try {
      const response = await fetch('/api/places/all');
      if (response.ok) {
        const data = await response.json();
        setAllPlaces(data.places);
        allPlacesLoadedRef.current = true;
      }
    } catch (error) {
      console.error('[HomePage] failed to load all places:', error);
    } finally {
      allPlacesLoadingRef.current = false;
    }
  }, []);

  // Bounds ???????????????????????????沃섃뫚?????????(????????????ル?????
  const loadPlacesByBounds = useCallback(async (bounds: MapBounds) => {
    const cellIds = getCellIdsForBounds(bounds);

    if (!cellIds) {
      return;
    }

    const newCellIds = cellIds.filter(
      (id) => !loadedCellIdsRef.current.has(id) && !loadingCellIdsRef.current.has(id)
    );
    if (newCellIds.length === 0) {
      return;
    }

    newCellIds.forEach((id) => loadingCellIdsRef.current.add(id));
    setLoadingPlaces(true);

    try {
      const newPlaces = await getPlacesByCellIds(newCellIds);

      newCellIds.forEach((id) => loadedCellIdsRef.current.add(id));

      const uniqueNewPlaces = newPlaces.filter(
        (p) => !loadedPlaceIdsRef.current.has(p.placeId)
      );

      if (uniqueNewPlaces.length > 0) {
        uniqueNewPlaces.forEach((p) => loadedPlaceIdsRef.current.add(p.placeId));
        setPlaces((prev) => [...prev, ...uniqueNewPlaces]);
      }
    } catch (error) {
      console.error('[HomePage] failed to load places by bounds:', error);
    } finally {
      newCellIds.forEach((id) => loadingCellIdsRef.current.delete(id));
      setLoadingPlaces(false);
    }
  }, []);

  const handleBoundsChange = useCallback(async (bounds: MapBounds, zoom: number) => {
    setCurrentBounds(bounds);
    setCurrentZoom(zoom);
    setMapZoom((prev) => (prev === zoom ? prev : zoom));

    const center = {
      lat: (bounds.sw.lat + bounds.ne.lat) / 2,
      lng: (bounds.sw.lng + bounds.ne.lng) / 2,
    };

    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(
          MAP_STATE_STORAGE_KEY,
          JSON.stringify({ center, zoom })
        );
      } catch (error) {
        console.error('failed to persist map state:', error);
      }
    }

    if (filterState.isActive) {
      return;
    }

    if (zoom <= CLUSTER_MAX_ZOOM) {
      await loadAllPlaces();
    }

    if (!hasInitialLoadedRef.current) {
      hasInitialLoadedRef.current = true;
      loadedCellIdsRef.current.clear();
      loadedPlaceIdsRef.current.clear();
    }

    await loadPlacesByBounds(bounds);
  }, [filterState.isActive, loadPlacesByBounds, loadAllPlaces]);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('????????????袁⑸즴筌?씛彛???????????곕츧??', error);
    }
  };

  // ??癲됱빖???嶺???????????롮쾸?椰???⑤챶琉덆땡????????⑤벡瑜??????API ???遺얘턁???????
  const handleQueryChange = useCallback(async (query: string) => {
    setSearchLoading(true);
    try {
      const response = await fetch(
        `/api/places/search?keyword=${encodeURIComponent(query)}&limit=10`
      );
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.places);
        setSearchTotal(data.total);
      }
    } catch (error) {
      console.error('[HomePage] Search error:', error);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // ??癲됱빖???嶺??????癲됱빖???嶺???????????????븐뼐?????????????+ ?????獄쏅챶留덌┼????????????????????
  const handleResultClick = useCallback((result: SearchResultItem) => {
    setMapCenter({ lat: result.lat, lng: result.lng });
    setMapZoom(16);

    const existingPlace = places.find((p) => p.placeId === result.placeId);
    if (existingPlace) {
      setSelectedPlace(existingPlace);
    } else {
      pendingSelectRef.current = result.placeId;
    }
  }, [places]);

  const handleMarkerClick = useCallback((place: Place) => {
    setSelectedPlace(place);
  }, []);

  const handleVisiblePlaceClick = useCallback((place: Place) => {
    // ??????醫딇떍?????繹먮굞議????????????????袁⑸즴筌?씛彛???????? ??????⑤벡瑜??????????嚥▲굧?먩뤆????????????????
    setMapZoom((prev) => (prev === currentZoom ? prev : currentZoom));
    setMapCenter({ lat: place.lat, lng: place.lng });
    setSelectedPlace(place);
  }, [currentZoom]);

  // ??癲됱빖???嶺??????癲됱빖???嶺?????????????대첉????"???耀붾굝?????????????熬곣몿??? ??癲됱빖???嶺?????????? ?????
  const handleAddSearchClick = useCallback((query: string) => {
    router.push(`/add?q=${encodeURIComponent(query)}`);
  }, [router]);

  // ??癲됱빖???嶺??????癲됱빖???嶺???????????places???????ル??? ???????????ｋ젒????????????獄쏅챶留덌┼?????????????????????????
  useEffect(() => {
    if (pendingSelectRef.current) {
      const place = places.find((p) => p.placeId === pendingSelectRef.current);
      if (place) {
        setSelectedPlace(place);
        pendingSelectRef.current = null;
      }
    }
  }, [places]);

  useEffect(() => {
    if (currentZoom <= CLUSTER_MAX_ZOOM && hoveredPlaceId) {
      setHoveredPlaceId(null);
    }
  }, [currentZoom, hoveredPlaceId]);

  const handleFilterChange = useCallback(async (newFilterState: FilterState) => {
    setFilterState(newFilterState);

    // ??????????뀀?????됰Ŧ??怨뺢께????????????쎛 ?????????癲?????猷멤꼻??????嚥싲갭큔??? ??? ??癲됱빖???嶺??????????嶺뚮∥?????????????袁⑸즴筌?씛彛??bounds ?????
    if (!newFilterState.isActive) {
      // ?????? ????????븐뼐???????????븐뼔???ш끽維뽭뇡硫㏓꺌?용뿪??큺?????????嶺뚮∥?????
      loadedPlaceIdsRef.current.clear();
      loadedCellIdsRef.current.clear();
      setPlaces([]);
      hasInitialLoadedRef.current = false;

      // ??????袁⑸즴筌?씛彛??bounds???????ル??? ???????롮쾸?椰?嚥▲굧???븍툖????????븐뼐????傭?끆?????Β?ｊ콞?轅붽틓?????⑸걦????????
      if (currentBounds) {
        console.log('[HomePage] Filter disabled, reloading current bounds');
        await loadPlacesByBounds(currentBounds);
      }
      return;
    }

    // ??????????뀀???????????泥???????????????????????곕?????????????????沃섃뫚???????耀붾굝?????傭?끆????椰?(????븐뼐???????????롪퍓媛앲굜???????????????ろ떀?????????곕????????
    setPlaces([]);
    loadedPlaceIdsRef.current.clear();
    loadedCellIdsRef.current.clear();
    setLoadingPlaces(true);

    try {
      const queryParams = new URLSearchParams();

      if (newFilterState.categories?.length) {
        queryParams.set('categories', newFilterState.categories.join(','));
      }
      if (newFilterState.tiers?.length) {
        queryParams.set('tiers', newFilterState.tiers.join(','));
      }
      if (newFilterState.regions?.length) {
        queryParams.set('regions', newFilterState.regions.join(','));
      }
      if (newFilterState.minReviews) {
        queryParams.set('minReviews', newFilterState.minReviews.toString());
      }
      if (newFilterState.wishOnly) {
        queryParams.set('wishOnly', 'true');
      }
      if (newFilterState.unvisitedOnly) {
        queryParams.set('unvisitedOnly', 'true');
      }
      if (newFilterState.sortBy) {
        queryParams.set('sortBy', newFilterState.sortBy);
      }
      if (newFilterState.sortOrder) {
        queryParams.set('sortOrder', newFilterState.sortOrder);
      }
      if (user?.uid) {
        queryParams.set('uid', user.uid);
      }

      const url = `/api/places/filter?${queryParams.toString()}`;
      console.log('[HomePage] Filter API URL:', url);

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[HomePage] Filter API error:', errorData);
        throw new Error('Filter API failed');
      }

      const data = await response.json();
      console.log('[HomePage] Filter API response:', {
        totalCount: data.stats?.totalCount,
        filteredCount: data.stats?.filteredCount,
        placesLength: data.places?.length,
      });

      setPlaces(data.places || []);

      // ??????????뀀??????븐뼐???????????븐뼔??????????????????轅붽틓????????
      loadedPlaceIdsRef.current.clear();
      loadedCellIdsRef.current.clear();
    } catch (error) {
      console.error('??????????뀀?????됰Ŧ??????????????ㅻ쑋??', error);
      alert('??????????뀀?????됰Ŧ????????????????ㅻ쑋????????ル??? ?????獄쏅챶留덌┼????????ル뒌嶺뚮씮??????????????????????⑤챷竊?');
    } finally {
      setLoadingPlaces(false);
    }
  }, [user?.uid, currentBounds, loadPlacesByBounds]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">????????沃섃뫚??????..</p>
      </div>
    );
  }

  return (
    <main className="relative h-screen w-full flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">Dong-go</h1>
          {firebaseUser && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-sm text-gray-600">{user?.nickname}</span>
              {user?.role === 'pending' && (
                <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                  ?????????
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(user?.role === 'member' || user?.role === 'owner') && (
            <Link
              href="/me"
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Profile"            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>
          )}
          {(user?.role === 'member' || user?.role === 'owner') && (
            <Link
              href="/me/wishlist"
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Wishlist"            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </Link>
          )}
          {(user?.role === 'member' || user?.role === 'owner') && (
            <Link
              href="/leaderboard"
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Leaderboard"            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            </Link>
          )}
          {user?.role === 'owner' && (
            <Link
              href="/admin"
              className="text-sm px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            >
              ???????ㅳ늾????????醫딇떍????
            </Link>
          )}
          {firebaseUser ? (
            <button
              onClick={handleLogout}
              className="text-sm px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              ????????????袁⑸즴筌?씛彛??
            </button>
          ) : (
            <Link
              href="/login"
              className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              ????????
            </Link>
          )}
        </div>
      </header>

      {/* Search Bar */}
      <div className="absolute top-20 left-4 right-4 z-20 max-w-md mx-auto">
        <SearchBar
          placeholder="????븐뼐?????????雅?퍔瑗?땟?????癲됱빖???嶺????.."
          onFilterChange={handleFilterChange}
          searchResults={searchResults}
          searchLoading={searchLoading}
          searchTotal={searchTotal}
          onResultClick={handleResultClick}
          onAddSearchClick={handleAddSearchClick}
          onQueryChange={handleQueryChange}
        />
      </div>

      {/* ????븐뼐??????轅붽틓?????獄쎼끇??????????袁⑸즴筌?씛彛?????????곗뿨????嚥▲굧?먩뤆?????????關?쒎첎?嫄??怨몄겮??(member/owner?? */}
      {(user?.role === 'member' || user?.role === 'owner') && (
        <div className="absolute top-36 left-4 md:left-auto md:right-4 z-20">
          <HallOfFamePreview />
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        <NaverMapView
          key={mapKey}
          places={places}
          allPlaces={allPlaces}
          onMarkerClick={handleMarkerClick}
          onBoundsChange={handleBoundsChange}
          center={mapCenter}
          zoom={mapZoom}
          isFilterActive={filterState.isActive}
          highlightedPlaceId={highlightedPlaceId}
        />

        {showVisiblePlacesPanel && (
          <aside className="absolute top-52 left-4 z-20 hidden md:block w-80">
            <div className="rounded-xl border border-gray-200 bg-white/95 shadow-lg backdrop-blur-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-sm font-semibold text-gray-800">Visible Restaurants</p>
                <p className="text-xs text-gray-500 mt-1">{visiblePlaces.length} shown</p>
              </div>
              {visiblePlaces.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  ??????袁⑸즴筌?씛彛??????癲?傭?????????⑤벡瑜????????耀붾굝??????????????濚밸Ŧ援???????????⑤챷竊?
                </div>
              ) : (
                <ul className="max-h-[55vh] overflow-y-auto divide-y divide-gray-100">
                  {visiblePlaces.map((place) => {
                    const isActive = highlightedPlaceId === place.placeId;
                    return (
                      <li key={place.placeId}>
                        <button
                          type="button"
                          onMouseEnter={() => setHoveredPlaceId(place.placeId)}
                          onMouseLeave={() => setHoveredPlaceId(null)}
                          onFocus={() => setHoveredPlaceId(place.placeId)}
                          onBlur={() => setHoveredPlaceId(null)}
                          onClick={() => handleVisiblePlaceClick(place)}
                          className={`w-full text-left px-4 py-3 transition-colors ${
                            isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-sm font-medium truncate ${isActive ? 'text-blue-700' : 'text-gray-900'}`}>
                              {place.name}
                            </p>
                            {place.avgTier && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex-shrink-0">
                                {place.avgTier}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-gray-500 line-clamp-1">{place.address}</p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
        )}

        {/* ??????????뀀??????????沃섃뫚????????????源낆┸????????롮쾸?椰???⑤챷寃?┼?*/}
        {loadingPlaces && filterState.isActive && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-30">
            <div className="bg-white rounded-xl shadow-lg px-6 py-4 flex items-center gap-3">
              <svg
                className="animate-spin h-5 w-5 text-blue-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-sm font-medium text-gray-700">
                ??????????뀀???????????泥????..
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sheet */}
      <PlaceBottomSheet
        place={selectedPlace}
        onClose={() => {
          setSelectedPlace(null);
          setHoveredPlaceId(null);
        }}
      />

      {/* Status Info */}
      <div className="absolute bottom-28 md:bottom-4 left-4 bg-white rounded-lg shadow-md px-3 py-2 text-xs text-gray-600 z-10">
        {loadingPlaces ? '????????沃섃뫚??????..' : (
          <>
            {`${places.length} places shown`}
            {filterState.isActive && (
              <span className="ml-2 text-blue-600 font-semibold">
                (??????????뀀???????????泥???
              </span>
            )}
          </>
        )}
      </div>

      {/* ??????????熬곣몿??? ???????(member/owner?? */}
      {(user?.role === 'member' || user?.role === 'owner') && (
        <Link
          href="/add"
          className="absolute bottom-28 md:bottom-6 right-4 z-10 group"
          aria-label="????븐뼐?????????雅?퍔瑗?땟?????????熬곣몿???"
        >
          <div className="flex items-center gap-2 bg-gradient-to-r from-rose-500 via-pink-500 to-rose-500 text-white pl-4 pr-5 py-3 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 border border-rose-400/30">
            <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="font-semibold text-sm">????븐뼐?????????雅?퍔瑗?땟?????????熬곣몿???</span>
          </div>
        </Link>
      )}
    </main>
  );
}
