import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BOARD, GROUPS } from '../engine/board';
import { buildSlot } from './layout';
import { envMapPartagee } from './environnement';
import type { CityTile, GameState } from '../engine/types';

/**
 * Constructions en relief. La montée est animée (ressort amorti) :
 * un bâtiment ne « pop » jamais, il sort du sol.
 */
const WINDOW_MAT = new THREE.MeshStandardMaterial({
  color: '#FDE68A', emissive: '#F59E0B', emissiveIntensity: 1.6, roughness: 0.3,
});

/**
 * Couronnement du Grand Hôtel, dessiné d'après le repère de la ville
 * (`landmark`) : à plein développement, Le Caire, Rome ou Bangkok ne se
 * ressemblent pas.
 */
const Crown = ({ landmark, mat }: { landmark: CityTile['landmark']; mat: THREE.Material }) => {
  switch (landmark) {
    case 'pyramid':
      return (
        <mesh castShadow material={mat} position={[0, 1.08, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[0.32, 0.42, 4]} />
        </mesh>
      );
    case 'dome':
      return (
        <mesh castShadow material={mat} position={[0, 1.0, 0]}>
          <sphereGeometry args={[0.24, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      );
    case 'pagoda':
      return (
        <group position={[0, 0.98, 0]}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} castShadow material={mat} position={[0, i * 0.16, 0]}>
              <coneGeometry args={[0.3 - i * 0.07, 0.1, 4]} />
            </mesh>
          ))}
        </group>
      );
    case 'arch':
      return (
        <mesh castShadow material={mat} position={[0, 1.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.2, 0.05, 6, 16, Math.PI]} />
        </mesh>
      );
    case 'bridge':
      return (
        <group position={[0, 1.02, 0]}>
          <mesh castShadow material={mat} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.22, 0.035, 6, 16, Math.PI]} />
          </mesh>
          <mesh castShadow material={mat} position={[0, -0.1, 0]}>
            <boxGeometry args={[0.56, 0.04, 0.1]} />
          </mesh>
        </group>
      );
    case 'skyline':
      return (
        <group position={[0, 1.0, 0]}>
          {[-0.16, 0, 0.16].map((x, i) => (
            <mesh key={x} castShadow material={mat} position={[x, [0.1, 0.22, 0.06][i], 0]}>
              <boxGeometry args={[0.12, [0.26, 0.5, 0.18][i], 0.12]} />
            </mesh>
          ))}
        </group>
      );
    case 'tower':
      return (
        <mesh castShadow material={mat} position={[0, 1.1, 0]}>
          <cylinderGeometry args={[0.05, 0.2, 0.46, 6]} />
        </mesh>
      );
    default: // spire
      return (
        <mesh castShadow material={mat} position={[0, 1.14, 0]}>
          <coneGeometry args={[0.15, 0.56, 8]} />
        </mesh>
      );
  }
};

/*
  Facteur d'échelle des constructions.

  Les volumes sont dessinés en unités de case ; plutôt que de reprendre chaque
  cote, un seul facteur les met à l'échelle.

  Il a été réduit depuis que le plateau est illustré : les bâtiments se posent
  désormais sur un dessin, et non sur un aplat. Trop gros, ils écrasaient la
  vue de la ville — alors que c'est elle qui donne son identité à la case.
*/
const BUILD_SCALE = 0.95;

/*
  Couleur des bâtiments : ivoire et terre cuite, et non la teinte du groupe.

  Reprendre la couleur du groupe n'apporte plus rien : elle est déjà sur la
  case, en bandeau, et la pastille du propriétaire dit à qui elle appartient.
  Le bâtiment n'avait donc qu'une information à porter — combien — et il la
  portait dans une teinte souvent sombre, brune ou bleu nuit, qui se lisait
  comme une tache noire posée sur une illustration claire.

  Ivoire et terre cuite se détachent sur tous les fonds du plateau, à toutes
  les positions de caméra, et renvoient à la maison de jeu en plastique dont
  tout le monde connaît la silhouette.
*/
const CORPS = new THREE.MeshPhysicalMaterial({
  color: '#F2E6CE', roughness: 0.45, metalness: 0.02, clearcoat: 0.4, clearcoatRoughness: 0.3,
});
const TOIT = new THREE.MeshStandardMaterial({ color: '#C0442C', roughness: 0.55 });
const HOTEL = new THREE.MeshPhysicalMaterial({
  color: '#B8382A', roughness: 0.4, metalness: 0.05, clearcoat: 0.55, clearcoatRoughness: 0.25,
});

const Structure = ({
  level, color, landmark,
}: { level: number; color: string; landmark: CityTile['landmark'] }) => {
  const gl = useThree((s) => s.gl);
  // La teinte du groupe ne sert plus qu'au couronnement de l'hôtel : un
  // rappel discret, sur le seul volume assez grand pour le porter.
  const mat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.38,
        metalness: 0.08,
        clearcoat: 0.6,
        clearcoatRoughness: 0.25,
        envMap: envMapPartagee(gl),
        envMapIntensity: 0.85,
      }),
    [color, gl],
  );

  /*
    Plus d'embase sombre.

    Elle existait pour ancrer le volume sur une case imprimée en aplat. Sur
    une illustration, elle ne fait qu'ajouter un rectangle noir : l'ombre
    portée des bâtiments suffit désormais à les poser.
  */
  const socle = null;

  /** Pavillon : corps, toit à quatre pentes, fenêtre éclairée. */
  const maison = (x: number, z = 0, echelle = 1) => (
    <group key={`${x}:${z}`} position={[x, 0, z]} scale={echelle}>
      <mesh castShadow material={CORPS} position={[0, 0.17, 0]}>
        <boxGeometry args={[0.52, 0.34, 0.46]} />
      </mesh>
      <mesh castShadow material={TOIT} position={[0, 0.42, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.42, 0.24, 4]} />
      </mesh>
      <mesh material={WINDOW_MAT} position={[0, 0.16, 0.235]}>
        <planeGeometry args={[0.16, 0.12]} />
      </mesh>
    </group>
  );

  /*
    Un palier, un pavillon de plus.

    On pourrait grossir un seul bâtiment à chaque palier ; compter des
    maisons est plus sûr. Une hauteur ne se compare qu'en regardant la case
    voisine, alors qu'un nombre se lit sur la case elle-même — et c'est ce
    qu'on veut savoir en arrivant dessus : combien de maisons, donc quel
    loyer. Les pavillons rétrécissent à mesure qu'ils se multiplient, pour
    tenir dans l'emprise sans jamais déborder sur le nom de la ville.
  */
  if (level >= 1 && level <= 4) {
    const plans: [number, number][][] = [
      [[0, 0]],
      [[-0.17, 0], [0.17, 0]],
      [[-0.25, 0], [0, 0], [0.25, 0]],
      [[-0.17, -0.15], [0.17, -0.15], [-0.17, 0.15], [0.17, 0.15]],
    ];
    const echelles = [1, 0.78, 0.62, 0.58];
    return (
      <group>
        {socle}
        {plans[level - 1].map(([x, z]) => maison(x, z, echelles[level - 1]))}
      </group>
    );
  }

  // Hôtel : tour, enseigne et couronne lumineuse — le sommet du barème.
  return (
    <group>
      {socle}
      {/* Corps en terre cuite : l'hôtel se distingue de la maison par la
          couleur autant que par la taille, comme sur un plateau de table. */}
      <mesh castShadow material={HOTEL} position={[0, 0.34, 0]}>
        <boxGeometry args={[0.62, 0.68, 0.52]} />
      </mesh>
      <mesh castShadow material={HOTEL} position={[0, 0.84, 0]}>
        <boxGeometry args={[0.44, 0.34, 0.4]} />
      </mesh>
      {/* Seul rappel de la couleur du groupe, tout en haut. */}
      <Crown landmark={landmark} mat={mat} />
      <mesh position={[0, 1.52, 0]}>
        <sphereGeometry args={[0.055, 12, 12]} />
        <meshStandardMaterial color="#FDE68A" emissive="#FDE68A" emissiveIntensity={3} />
      </mesh>
      {[0.12, 0.34, 0.56].map((y) => (
        <mesh key={y} material={WINDOW_MAT} position={[0, y, 0.262]}>
          <planeGeometry args={[0.42, 0.1]} />
        </mesh>
      ))}
      <mesh material={WINDOW_MAT} position={[0, 0.84, 0.205]}>
        <planeGeometry args={[0.3, 0.08]} />
      </mesh>
    </group>
  );
};

const Plot = ({ tile, level }: { tile: CityTile; level: number }) => {
  const slot = useMemo(() => buildSlot(tile.i), [tile.i]);
  const group = useRef<THREE.Group>(null);
  const grow = useRef(level > 0 ? 1 : 0);
  const target = useRef(level > 0 ? 1 : 0);
  const spin = useRef(0);
  const previous = useRef<number | null>(null);

  useEffect(() => {
    const first = previous.current === null;
    const raised = !first && level > (previous.current ?? 0);
    previous.current = level;
    target.current = level > 0 ? 1 : 0;
    if (raised) {
      // Construction nouvelle : on repart de zéro pour jouer la montée.
      grow.current = 0;
      spin.current = 1;
    } else if (first && level > 0) {
      // Bâtiment déjà là (arrivée en cours de partie, reconnexion, onglet
      // resté en arrière-plan) : il doit être debout dès la première image,
      // sans rejouer une animation qui a déjà eu lieu.
      grow.current = 1;
    }
  }, [level]);

  // Applique l'échelle immédiatement : la première image peinte est correcte
  // même si la boucle d'animation n'a pas encore tourné.
  useLayoutEffect(() => {
    if (!group.current) return;
    const g = grow.current;
    group.current.scale.set(1, Math.max(0.0001, g), 1);
    group.current.visible = g > 0.005;
  });

  useFrame((_, dt) => {
    if (!group.current) return;
    // Vingt-quatre parcelles tournent ce rappel à chaque image. Quand la
    // parcelle est nue et stable, il n'y a rien à interpoler : on sort tout
    // de suite plutôt que de recalculer une échelle inchangée soixante fois
    // par seconde.
    if (target.current === grow.current && spin.current <= 0) return;
    const k = Math.min(1, dt * 3.4);
    grow.current += (target.current - grow.current) * k;
    const g = grow.current;
    // Léger dépassement : la structure « s'installe » au lieu d'arriver plat.
    const overshoot = 1 + Math.sin(Math.min(1, g) * Math.PI) * 0.12;
    group.current.scale.set(overshoot, Math.max(0.0001, g * overshoot), overshoot);
    if (spin.current > 0) {
      spin.current = Math.max(0, spin.current - dt * 1.2);
      group.current.rotation.y = slot.rot + spin.current * Math.PI * 0.9;
    } else {
      group.current.rotation.y = slot.rot;
    }
    group.current.visible = g > 0.005;
  });

  if (level === 0) return null;
  return (
    <group ref={group} position={slot.pos} rotation={[0, slot.rot, 0]}>
      {/* Groupe intermédiaire : l'échelle de la montée est animée sur le
          groupe parent, elle ne peut pas porter aussi le facteur fixe. */}
      <group scale={BUILD_SCALE}>
        <Structure level={level} color={GROUPS[tile.group].color} landmark={tile.landmark} />
      </group>
    </group>
  );
};

export const Buildings = ({ state }: { state: GameState }) => (
  <group>
    {BOARD.filter((t): t is CityTile => t.kind === 'city').map((t) => (
      <Plot key={t.i} tile={t} level={state.tiles[t.i]?.level ?? 0} />
    ))}
  </group>
);
