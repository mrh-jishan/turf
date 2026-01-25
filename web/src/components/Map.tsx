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

export default function Map({ center, claims = [] }: Props) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loaded, setLoaded] = useState(false);

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
    });
    map.on('load', () => setLoaded(true));
    mapRef.current = map;
    return () => map.remove();
  }, [center]);

  useEffect(() => {
    if (loaded && mapRef.current) {
      mapRef.current.easeTo({ center, duration: 800 });
    }
  }, [center, loaded]);

  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const map = mapRef.current;

    const sourceId = 'claims';
    if (map.getLayer('claims-label')) map.removeLayer('claims-label');
    if (map.getLayer('claims-pulse')) map.removeLayer('claims-pulse');
    if (map.getSource(sourceId)) map.removeSource(sourceId);

    map.addSource(sourceId, {
      type: 'geojson',
      data: buildGeoJSON(claims),
    });

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

    const customLayerId = 'claims-3d';
    if (map.getLayer(customLayerId)) map.removeLayer(customLayerId);
    map.addLayer(makeThreeLayer(customLayerId, claims));
  }, [claims, loaded]);

  return (
    <div className="relative w-full h-[70vh] rounded-3xl overflow-hidden shadow-glow">
      {!mapboxgl.accessToken && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 text-center px-6 text-sm">
          Set NEXT_PUBLIC_MAPBOX_TOKEN to view the map.
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
