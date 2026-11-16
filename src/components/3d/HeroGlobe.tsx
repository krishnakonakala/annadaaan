import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export const HeroGlobe: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasWebGlError, setHasWebGlError] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setHasWebGlError(true);
      return;
    }

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 500;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 240;

    // Outer glow globe / wireframe network
    const globeRadius = 75;
    const globeGeometry = new THREE.SphereGeometry(globeRadius, 28, 28);
    const globeMaterial = new THREE.MeshBasicMaterial({
      color: 0x059669, // Emerald
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });
    const globeMesh = new THREE.Mesh(globeGeometry, globeMaterial);
    scene.add(globeMesh);

    // Inner darker core
    const innerGeo = new THREE.SphereGeometry(globeRadius * 0.98, 20, 20);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x022c22,
      transparent: true,
      opacity: 0.4,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    scene.add(innerMesh);

    // Dynamic rescue network node points
    const nodeCoords = [
      { lat: 16.4649, lon: 80.5083, label: 'Mangalagiri · Amaravati' },
      { lat: 12.9, lon: 77.5, label: 'Bengaluru' },
      { lat: 19.0, lon: 72.8, label: 'Mumbai' },
      { lat: 28.6, lon: 77.2, label: 'Delhi NCR' },
      { lat: 13.0, lon: 80.2, label: 'Chennai' },
      { lat: 22.5, lon: 88.3, label: 'Kolkata' },
      { lat: 23.0, lon: 72.5, label: 'Ahmedabad' },
      { lat: 18.5, lon: 73.8, label: 'Pune' },
    ];

    const nodesGroup = new THREE.Group();
    const nodeVectors: THREE.Vector3[] = [];

    nodeCoords.forEach((node) => {
      const phi = (90 - node.lat) * (Math.PI / 180);
      const theta = (node.lon + 180) * (Math.PI / 180);
      const x = -(globeRadius * Math.sin(phi) * Math.cos(theta));
      const z = globeRadius * Math.sin(phi) * Math.sin(theta);
      const y = globeRadius * Math.cos(phi);

      const vec = new THREE.Vector3(x, y, z);
      nodeVectors.push(vec);

      // Node pin
      const pinGeo = new THREE.SphereGeometry(2.4, 12, 12);
      const pinMat = new THREE.MeshBasicMaterial({
        color: 0x34d399, // Bright emerald green
      });
      const pinMesh = new THREE.Mesh(pinGeo, pinMat);
      pinMesh.position.copy(vec);
      nodesGroup.add(pinMesh);

      // Pulsing outer halo for node
      const haloGeo = new THREE.RingGeometry(2.8, 4.2, 16);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.position.copy(vec.clone().multiplyScalar(1.01));
      haloMesh.lookAt(new THREE.Vector3(0, 0, 0));
      nodesGroup.add(haloMesh);
    });

    globeMesh.add(nodesGroup);

    // Arcs connecting donor hubs to receiving shelters
    const arcsGroup = new THREE.Group();
    for (let i = 0; i < nodeVectors.length; i++) {
      for (let j = i + 1; j < nodeVectors.length; j++) {
        // connect nearby or select pairs
        if ((i + j) % 2 === 0) {
          const v1 = nodeVectors[i];
          const v2 = nodeVectors[j];

          // Compute midpoint elevated outward
          const mid = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);
          const distance = v1.distanceTo(v2);
          mid.normalize().multiplyScalar(globeRadius + distance * 0.28);

          const curve = new THREE.QuadraticBezierCurve3(v1, mid, v2);
          const points = curve.getPoints(24);
          const curveGeo = new THREE.BufferGeometry().setFromPoints(points);
          const curveMat = new THREE.LineBasicMaterial({
            color: 0xf59e0b, // Amber / Warm orange food line
            transparent: true,
            opacity: 0.6,
          });
          const arcLine = new THREE.Line(curveGeo, curveMat);
          arcsGroup.add(arcLine);
        }
      }
    }
    globeMesh.add(arcsGroup);

    // Ambient floating stardust particles representing saved meals
    const particleCount = 200;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      const r = globeRadius + 15 + Math.random() * 50;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      particlePositions[i] = r * Math.sin(phi) * Math.cos(theta);
      particlePositions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      particlePositions[i + 2] = r * Math.cos(phi);
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x10b981,
      size: 1.8,
      transparent: true,
      opacity: 0.7,
    });
    const particlePoints = new THREE.Points(particleGeo, particleMat);
    scene.add(particlePoints);

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      globeMesh.rotation.y += 0.0035;
      globeMesh.rotation.x = Math.sin(Date.now() * 0.0005) * 0.1;
      particlePoints.rotation.y -= 0.001;

      renderer.render(scene, camera);
    };

    animate();

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      globeGeometry.dispose();
      globeMaterial.dispose();
      innerGeo.dispose();
      innerMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();
    };
  }, []);

  if (hasWebGlError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 rounded-2xl bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 text-center">
        <div className="w-24 h-24 rounded-full border-2 border-emerald-500/40 border-dashed animate-spin flex items-center justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold">
            ANNADAAN
          </div>
        </div>
        <p className="text-zinc-400 text-sm">Geospatial Real-Time Redistribution Network Active</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[380px] sm:h-[460px] lg:h-[520px] flex items-center justify-center select-none overflow-hidden">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] text-zinc-400 font-mono pointer-events-none bg-zinc-900/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-zinc-800/80">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          <span>GEOSPATIAL RESCUE NODES ACTIVE</span>
        </span>
        <span className="hidden sm:inline text-zinc-400">MANGALAGIRI • AMARAVATI • VIJAYAWADA • BENGALURU</span>
      </div>
    </div>
  );
};
