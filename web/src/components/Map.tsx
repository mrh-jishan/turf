'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl, { Map } from 'mapbox-gl';
import * as THREE from 'three';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

export interface ClaimFeature {
  id: string;
  lat: number;
  lon: number;
  address_label: string;
  prefab?: string;
  flag?: string;
  height_m?: number;
}

interface Props {
  center: [number, number];
  claims?: ClaimFeature[];
  fogGeojson?: any;
  visibleGeojson?: any;
  onLocationSelect?: (lat: number, lon: number) => void;
}

function buildGeoJSON(claims: ClaimFeature[]) {
  return {
    type: 'FeatureCollection',
    features: claims.map((c) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
      properties: {
        id: c.id,
        title: c.address_label,
        prefab: c.prefab ?? 'cyber',
        flag: c.flag ?? 'usa',
        height: c.height_m ?? 10,
      },
    })),
  } as any;
}

function makeThreeLayer(id: string, claims: ClaimFeature[]): mapboxgl.CustomLayerInterface {
  let camera: THREE.Camera;
  let scene: THREE.Scene;
  let renderer: THREE.WebGLRenderer;
  let map: Map;

  const meshes: THREE.Object3D[] = [];
  const colorMap: Record<string, string> = {
    cyber: '#5af5ff',
    castle: '#ff4fa7',
    cottage: '#ffbd59',
  };

  return {
    id,
    type: 'custom',
    renderingMode: '3d',
    onAdd(_map, gl) {
      map = _map;
      camera = new THREE.Camera();
      scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x050914, 0.0025);

      const light = new THREE.DirectionalLight(0xffffff, 0.9);
      light.position.set(0, 70, 100).normalize();
      scene.add(light);
      scene.add(new THREE.AmbientLight(0x8899ff, 0.65));

      claims.forEach((c) => {
        const mc = mapboxgl.MercatorCoordinate.fromLngLat([c.lon, c.lat], 0);
        const scale = mc.meterInMercatorCoordinateUnits();
        const height = (c.height_m ?? 10) * scale;
        const size = 12 * scale;

        const geometry = new THREE.BoxGeometry(size, size, height);
        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(colorMap[c.prefab ?? 'cyber'] || '#5af5ff'),
          emissive: new THREE.Color(colorMap[c.prefab ?? 'cyber'] || '#5af5ff').multiplyScalar(0.2),
          transparent: true,
          opacity: 0.95,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(mc.x, mc.y, height / 2);
        mesh.userData.id = c.id;
        meshes.push(mesh);
        scene.add(mesh);
      });

      renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });
      renderer.autoClear = false;
    },
    render(gl, matrix) {
      const m = new THREE.Matrix4().fromArray(matrix as unknown as number[]);
      camera.projectionMatrix = m;

      renderer.state.reset();
      renderer.render(scene, camera);
      map.triggerRepaint();
    },
    onRemove() {
      meshes.forEach((m) => scene.remove(m));
      renderer.dispose();
    },
  };
}

export default function Map({ center, claims = [], fogGeojson, visibleGeojson, onLocationSelect }: Props) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [styleLoaded, setStyleLoaded] = useState(false);
  const previousClaimsRef = useRef<ClaimFeature[]>([]);

  const handleZoom = (direction: 'in' | 'out') => {
    if (mapRef.current) {
      const currentZoom = mapRef.current.getZoom();
      const newZoom = direction === 'in' ? currentZoom + 1 : currentZoom - 1;
      mapRef.current.easeTo({ zoom: newZoom, duration: 300 });
    }
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !mapboxgl.accessToken) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center,
      zoom: 14,
      pitch: 55,
      bearing: -10,
      hash: false,
      cooperativeGestures: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    map.addControl(new mapboxgl.NavigationControl());
    map.addControl(new mapboxgl.FullscreenControl());
    
    map.on('style.load', () => {
      map.setFog({
        range: [-0.5, 2],
        color: 'rgb(5, 9, 20)',
        'high-color': '#5af5ff',
        'space-color': '#020409',
        'horizon-blend': 0.2,
      });
      map.setLight({ intensity: 0.8 });
      setStyleLoaded(true);
    });
    
    map.on('click', (e) => {
      if (onLocationSelect) {
        onLocationSelect(e.lngLat.lat, e.lngLat.lng);
      }
    });
    
    map.on('error', (e) => {
      console.error('Mapbox error:', e.error);
    });
    
    map.on('load', () => setLoaded(true));
    mapRef.current = map;
    return () => {
      setStyleLoaded(false);
      map.remove();
    };
  }, []);

  useEffect(() => {
    if (loaded && styleLoaded && mapRef.current) {
      try {
        // Ensure the map has a valid canvas and is fully rendered
        const map = mapRef.current;
        if (!map.getCanvas() || !map.getCenter) {
          console.warn('Map canvas not ready');
          return;
        }
        
        map.easeTo({ center, duration: 800 });
      } catch (e) {
        console.error('Error animating to center:', e);
        // Fallback: set center without animation
        if (mapRef.current?.setCenter) {
          try {
            mapRef.current.setCenter(center);
          } catch (err) {
            console.error('Error setting center:', err);
          }
        }
      }
    }
  }, [center, loaded, styleLoaded]);

  useEffect(() => {
    if (!styleLoaded || !mapRef.current) return;
    const map = mapRef.current;

    // Ensure map is ready
    if (!map.getStyle?.()) {
      console.warn('Map style not ready yet');
      return;
    }

    try {
      // fog layer
      const fogSource = 'fog';
      const fogLayer = 'fog-layer';
      try {
        if (map.getLayer?.(fogLayer)) map.removeLayer(fogLayer);
        if (map.getSource?.(fogSource)) map.removeSource(fogSource);
        if (fogGeojson) {
          try {
            const geoData = typeof fogGeojson === 'string' ? JSON.parse(fogGeojson) : fogGeojson;
            // Check if geojson is valid before adding
            if (geoData && geoData.type === 'FeatureCollection' && geoData.features) {
              map.addSource(fogSource, {
                type: 'geojson',
                data: geoData,
              });
              map.addLayer({
                id: fogLayer,
                type: 'fill',
                source: fogSource,
                paint: {
                  'fill-color': '#000',
                  'fill-opacity': 0.82,
                },
              }, 'claims-pulse'); // Place before claims layer so it doesn't cover
            }
          } catch (parseError) {
            console.warn('Failed to parse fog GeoJSON:', parseError);
          }
        }
      } catch (e) {
        console.error('Error adding fog layer:', e);
      }

      // visible glow
      const visSource = 'visible';
      const visLayer = 'visible-layer';
      try {
        if (map.getLayer?.(visLayer)) map.removeLayer(visLayer);
        if (map.getSource?.(visSource)) map.removeSource(visSource);
        if (visibleGeojson) {
          try {
            const geoData = typeof visibleGeojson === 'string' ? JSON.parse(visibleGeojson) : visibleGeojson;
            map.addSource(visSource, {
              type: 'geojson',
              data: geoData,
            });
            map.addLayer({
              id: visLayer,
              type: 'fill',
              source: visSource,
              paint: {
                'fill-color': '#5af5ff',
                'fill-opacity': 0.12,
                'fill-outline-color': '#5af5ff',
              },
            });
          } catch (parseError) {
            console.warn('Failed to parse visible GeoJSON:', parseError);
          }
        }
      } catch (e) {
        console.error('Error adding visible layer:', e);
      }

      const sourceId = 'claims';
      try {
        // Update existing source if it exists, otherwise create new one
        const existingSource = map.getSource?.(sourceId);
        const claimsGeoJSON = buildGeoJSON(claims);
        
        if (existingSource && existingSource.type === 'geojson') {
          // Update existing source data instead of recreating
          try {
            (existingSource as mapboxgl.GeoJSONSource).setData(claimsGeoJSON);
          } catch (e) {
            console.warn('Failed to update claims source, will recreate:', e);
            // Fallback: recreate the source
            if (map.getLayer?.('claims-label')) map.removeLayer('claims-label');
            if (map.getLayer?.('claims-pulse')) map.removeLayer('claims-pulse');
            map.removeSource(sourceId);
            throw e; // Re-throw to go to catch block below
          }
        } else {
          throw new Error('Source does not exist or is not GeoJSON'); // Force recreation
        }
      } catch (e) {
        try {
          // Remove old layers and source if they exist
          if (map.getLayer?.('claims-label')) map.removeLayer('claims-label');
          if (map.getLayer?.('claims-pulse')) map.removeLayer('claims-pulse');
          if (map.getSource?.(sourceId)) map.removeSource(sourceId);

          // Add new source
          const claimsGeoJSON = buildGeoJSON(claims);
          map.addSource(sourceId, {
            type: 'geojson',
            data: claimsGeoJSON,
          });

          // Add pulse layer
          map.addLayer({
            id: 'claims-pulse',
            type: 'circle',
            source: sourceId,
            paint: {
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                10,
                4,
                16,
                14,
              ],
              'circle-color': '#5af5ff',
              'circle-opacity': 0.35,
              'circle-stroke-width': 1.2,
              'circle-stroke-color': '#5af5ff',
            },
          });

          // Add label layer
          map.addLayer({
            id: 'claims-label',
            type: 'symbol',
            source: sourceId,
            layout: {
              'text-field': ['get', 'title'],
              'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
              'text-size': 12,
              'text-offset': [0, 1.2],
            },
            paint: {
              'text-color': '#e5ecff',
              'text-halo-color': '#050914',
              'text-halo-width': 1.2,
            },
          });
        } catch (err) {
          console.error('Error recreating claims layers:', err);
        }
      }

      // Only add 3D layer if it doesn't exist (prevent constant recreation)
      const customLayerId = 'claims-3d';
      if (!map.getLayer?.(customLayerId)) {
        try {
          map.addLayer(makeThreeLayer(customLayerId, claims));
        } catch (e) {
          console.error('Error adding 3D layer:', e);
        }
      }
      
      previousClaimsRef.current = claims;
    } catch (e) {
      console.error('Error in layer update effect:', e);
    }
  }, [claims, styleLoaded, fogGeojson, visibleGeojson]);

  return (
    <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-glow group">
      {!mapboxgl.accessToken && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 text-center px-6 text-sm">
          Set NEXT_PUBLIC_MAPBOX_TOKEN to view the map.
        </div>
      )}
      <div ref={containerRef} className="w-full h-full cursor-crosshair" />
      
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-30 flex flex-col gap-2">
        <button
          onClick={() => handleZoom('in')}
          className="bg-white/10 hover:bg-white/20 border border-white/30 hover:border-neon text-white rounded-lg p-2 transition flex items-center justify-center w-10 h-10 font-bold text-lg"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={() => handleZoom('out')}
          className="bg-white/10 hover:bg-white/20 border border-white/30 hover:border-neon text-white rounded-lg p-2 transition flex items-center justify-center w-10 h-10 font-bold text-lg"
          title="Zoom Out"
        >
          −
        </button>
      </div>
      
      {onLocationSelect && (
        <div className="absolute bottom-4 left-4 z-20 px-3 py-2 rounded-lg bg-black/60 border border-neon/50 text-xs text-neon animate-pulse">
          ✓ Click map to select location
        </div>
      )}
    </div>
  );
}
