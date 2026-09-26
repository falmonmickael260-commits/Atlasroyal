import { useMemo } from 'react';
import * as THREE from 'three';
import { GEO } from './layout';
import { rugTexture, wallTexture, woodTexture } from './textures';

/**
 * La pièce dans laquelle le jeu est posé.
 *
 * Tout ici est strictement immobile : murs, table, tapis, meubles, lampe.
 * C'est le point d'ancrage du regard — un plateau posé sur une vraie table,
 * pas une scène qui flotte. Aucun élément de ce module ne s'anime.
 */

const TABLE_R = GEO.half * 1.72;
const TABLE_Y = -0.86;
const FLOOR_Y = -9.4;

const Table = () => {
  const wood = useMemo(() => {
    const t = woodTexture();
    t.repeat.set(2.4, 2.4);
    return t;
  }, []);

  return (
    <group>
      {/* Plateau de la table */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, TABLE_Y, 0]} receiveShadow>
        <circleGeometry args={[TABLE_R, 80]} />
        <meshStandardMaterial map={wood} roughness={0.62} metalness={0.05} />
      </mesh>
      {/*
        Chant de la table.

        Ouvert en haut : sans cela, le couvercle du cylindre se retrouve
        exactement à la même hauteur et au même rayon que le disque du dessus.
        Deux surfaces coplanaires se disputent alors chaque pixel, et le
        résultat est un moirage de taches claires qui se déplacent avec la
        caméra — les « lumières bizarres » constatées sur le bois.
      */}
      <mesh position={[0, TABLE_Y - 0.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[TABLE_R, TABLE_R * 0.995, 0.38, 80, 1, true]} />
        <meshStandardMaterial color="#4A2F1D" roughness={0.75} metalness={0.04} side={THREE.DoubleSide} />
      </mesh>
      {/* Ceinture sous le plateau */}
      <mesh position={[0, TABLE_Y - 0.62, 0]}>
        <cylinderGeometry args={[TABLE_R * 0.88, TABLE_R * 0.86, 0.5, 48]} />
        <meshStandardMaterial color="#3B2517" roughness={0.85} />
      </mesh>
      {/* Quatre pieds tournés */}
      {[
        [1, 1], [1, -1], [-1, 1], [-1, -1],
      ].map(([sx, sz], i) => (
        <mesh
          key={i}
          position={[sx * TABLE_R * 0.62, (TABLE_Y + FLOOR_Y) / 2 - 0.3, sz * TABLE_R * 0.62]}
          castShadow
        >
          <cylinderGeometry args={[0.34, 0.5, TABLE_Y - FLOOR_Y - 0.6, 16]} />
          <meshStandardMaterial color="#3E2718" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
};

const Floor = () => {
  const rug = useMemo(() => rugTexture(), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]} receiveShadow>
        <planeGeometry args={[150, 150]} />
        <meshStandardMaterial color="#6A4A32" roughness={0.9} />
      </mesh>
      {/* Tapis sous la table : ancre la scène et réchauffe le sol. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y + 0.02, 2]} receiveShadow>
        <circleGeometry args={[TABLE_R * 1.9, 64]} />
        <meshStandardMaterial map={rug} roughness={0.95} />
      </mesh>
    </group>
  );
};

const Walls = () => {
  const paper = useMemo(() => {
    const t = wallTexture();
    t.repeat.set(4, 3);
    return t;
  }, []);
  const back = -GEO.half * 2.5;

  return (
    <group>
      {/* Mur du fond */}
      <mesh position={[0, FLOOR_Y + 22, back]} receiveShadow>
        <planeGeometry args={[150, 46]} />
        <meshStandardMaterial map={paper} roughness={0.96} />
      </mesh>
      {/* Plinthe */}
      <mesh position={[0, FLOOR_Y + 0.7, back + 0.12]}>
        <boxGeometry args={[150, 1.4, 0.24]} />
        <meshStandardMaterial color="#E8DCC8" roughness={0.7} />
      </mesh>
      {/* Murs latéraux, en biais léger pour fermer le champ sans l'écraser */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 54, FLOOR_Y + 22, back + 34]} rotation={[0, -s * Math.PI / 2, 0]}>
          <planeGeometry args={[80, 46]} />
          <meshStandardMaterial map={paper} roughness={0.96} />
        </mesh>
      ))}
    </group>
  );
};

/** Meubles et objets : profondeur et chaleur, sans voler la vedette au plateau. */
const Furniture = () => {
  const wood = useMemo(() => {
    const t = woodTexture();
    t.repeat.set(1.4, 1.4);
    return t;
  }, []);
  const back = -GEO.half * 2.5;

  return (
    <group>
      {/* Bibliothèque basse, en retrait à gauche */}
      <group position={[-30, FLOOR_Y, back + 4]}>
        <mesh position={[0, 4.6, 0]} castShadow receiveShadow>
          <boxGeometry args={[16, 9.2, 4]} />
          <meshStandardMaterial map={wood} roughness={0.7} />
        </mesh>
        {/* Livres : des blocs colorés, volontairement simples */}
        {Array.from({ length: 14 }, (_, i) => (
          <mesh key={i} position={[-6.8 + i * 1.02, 7.2, 2.1]} castShadow>
            <boxGeometry args={[0.7, 2.2 + ((i * 7) % 5) * 0.28, 0.5]} />
            <meshStandardMaterial
              color={['#8C3B3B', '#2F5D50', '#3C4A7A', '#8A6A2F', '#5B3A6B'][i % 5]}
              roughness={0.85}
            />
          </mesh>
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <mesh key={`b${i}`} position={[-6.2 + i * 1.08, 2.6, 2.1]} castShadow>
            <boxGeometry args={[0.76, 2 + ((i * 5) % 4) * 0.3, 0.5]} />
            <meshStandardMaterial
              color={['#3E6B54', '#7A3A46', '#45568C', '#96722F'][i % 4]}
              roughness={0.85}
            />
          </mesh>
        ))}
      </group>

      {/* Plante, à droite : une touche de vivant, figée */}
      <group position={[29, FLOOR_Y, back + 8]}>
        <mesh position={[0, 1.7, 0]} castShadow>
          <cylinderGeometry args={[1.8, 1.3, 3.4, 20]} />
          <meshStandardMaterial color="#9C5B3A" roughness={0.8} />
        </mesh>
        {Array.from({ length: 9 }, (_, i) => {
          const a = (i / 9) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * 1.5, 5.4 + (i % 3) * 1.1, Math.sin(a) * 1.5]}
              rotation={[Math.cos(a) * 0.5, a, Math.sin(a) * 0.5]}
              castShadow
            >
              <coneGeometry args={[0.9, 4.4, 5]} />
              <meshStandardMaterial color={i % 2 ? '#2F6B43' : '#3C8354'} roughness={0.9} />
            </mesh>
          );
        })}
      </group>

      {/* Cadre au mur : casse la surface nue sans attirer l'œil */}
      <mesh position={[8, FLOOR_Y + 19, back + 0.2]}>
        <boxGeometry args={[11, 8, 0.35]} />
        <meshStandardMaterial color="#5A3E28" roughness={0.6} />
      </mesh>
      <mesh position={[8, FLOOR_Y + 19, back + 0.4]}>
        <planeGeometry args={[9.6, 6.6]} />
        <meshStandardMaterial color="#20344A" roughness={0.9} />
      </mesh>
    </group>
  );
};

/** Lampe de chevet au fond de la pièce : la source chaude, hors du plateau. */
const SideLamp = () => (
  <group position={[26, FLOOR_Y, -GEO.half * 2.5 + 10]}>
    {/* Guéridon */}
    <mesh position={[0, 3.4, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[2.6, 2.6, 0.3, 24]} />
      <meshStandardMaterial color="#4A2F1D" roughness={0.7} />
    </mesh>
    <mesh position={[0, 1.7, 0]} castShadow>
      <cylinderGeometry args={[0.4, 0.55, 3.4, 12]} />
      <meshStandardMaterial color="#3E2718" roughness={0.8} />
    </mesh>
    {/* Pied et abat-jour */}
    <mesh position={[0, 5.2, 0]} castShadow>
      <cylinderGeometry args={[0.22, 0.34, 3.2, 12]} />
      <meshStandardMaterial color="#8A6A3C" roughness={0.45} metalness={0.5} />
    </mesh>
    <mesh position={[0, 7.6, 0]} castShadow>
      <coneGeometry args={[2.1, 2.6, 24, 1, true]} />
      <meshStandardMaterial
        color="#E8C88E"
        emissive="#FFD79A"
        emissiveIntensity={0.55}
        side={THREE.DoubleSide}
        roughness={0.85}
      />
    </mesh>
    {/* Lueur locale, volontairement faible : la lampe doit se voir sans
        projeter de tache sur la table, qui est loin. */}
    <pointLight position={[0, 7, 0]} intensity={14} distance={16} decay={2} color="#FFD9A0" />
  </group>
);

export const Room = ({ full = true }: { full?: boolean }) => (
  <group>
    <Table />
    {full && (
      <>
        <Floor />
        <Walls />
        <Furniture />
        <SideLamp />
      </>
    )}
  </group>
);
