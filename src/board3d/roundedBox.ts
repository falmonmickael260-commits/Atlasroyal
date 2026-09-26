import * as THREE from 'three';

/**
 * Cube aux arêtes arrondies, avec ses six groupes de faces intacts.
 *
 * three.js n'en fournit pas. On part d'une `BoxGeometry` subdivisée puis on
 * projette chaque sommet sur la surface d'un cube arrondi : pour un point `p`,
 * on borne ses coordonnées au cœur plat, puis on s'éloigne de ce cœur du rayon
 * de congé. Les normales se déduisent du même vecteur, ce qui donne des
 * reflets francs sur les arêtes — c'est ce qui fait qu'un dé ressemble à un
 * objet moulé plutôt qu'à une boîte.
 *
 * Les groupes de matériaux de la BoxGeometry sont conservés : les six faces
 * gardent chacune sa texture.
 */
export const roundedBoxGeometry = (
  size: number,
  radius: number,
  segments = 5,
): THREE.BufferGeometry => {
  const geo = new THREE.BoxGeometry(size, size, size, segments, segments, segments);
  const half = size / 2;
  const core = Math.max(0.0001, half - radius);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const nor = geo.attributes.normal as THREE.BufferAttribute;
  const p = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    c.set(
      THREE.MathUtils.clamp(p.x, -core, core),
      THREE.MathUtils.clamp(p.y, -core, core),
      THREE.MathUtils.clamp(p.z, -core, core),
    );
    n.subVectors(p, c);
    if (n.lengthSq() < 1e-8) n.set(0, 1, 0);
    n.normalize();
    pos.setXYZ(i, c.x + n.x * radius, c.y + n.y * radius, c.z + n.z * radius);
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  pos.needsUpdate = true;
  nor.needsUpdate = true;
  geo.computeBoundingSphere();
  return geo;
};
