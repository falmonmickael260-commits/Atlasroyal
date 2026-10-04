import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GEO, tokenSlot } from './layout';
import type { GameState, PlayerId } from '../engine/types';

/** Silhouettes de pions : chacune doit être reconnaissable en vue d'ensemble. */
const Shape = ({ token, mat }: { token: string; mat: THREE.Material }) => {
  switch (token) {
    case 't2': // Dirigeable
      return (
        <group>
          <mesh castShadow material={mat} position={[0, 0.3, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1.5, 1]}>
            <capsuleGeometry args={[0.13, 0.16, 6, 12]} />
          </mesh>
          <mesh material={mat} position={[0, 0.12, 0]}>
            <boxGeometry args={[0.12, 0.08, 0.08]} />
          </mesh>
        </group>
      );
    case 't3': // Cargo
      return (
        <group>
          <mesh castShadow material={mat} position={[0, 0.12, 0]}>
            <boxGeometry args={[0.38, 0.14, 0.2]} />
          </mesh>
          <mesh castShadow material={mat} position={[-0.06, 0.26, 0]}>
            <boxGeometry args={[0.16, 0.16, 0.16]} />
          </mesh>
        </group>
      );
    case 't4': // Monolithe
      return (
        <mesh castShadow material={mat} position={[0, 0.26, 0]}>
          <boxGeometry args={[0.2, 0.52, 0.12]} />
        </mesh>
      );
    case 't5': // Satellite
      return (
        <group>
          <mesh castShadow material={mat} position={[0, 0.3, 0]}>
            <icosahedronGeometry args={[0.14, 0]} />
          </mesh>
          <mesh material={mat} position={[0, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.24, 0.018, 6, 24]} />
          </mesh>
          <mesh material={mat} position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.03, 0.06, 0.2, 8]} />
          </mesh>
        </group>
      );
    case 't6': // Phare
      return (
        <group>
          <mesh castShadow material={mat} position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.09, 0.16, 0.44, 10]} />
          </mesh>
          <mesh material={mat} position={[0, 0.5, 0]}>
            <sphereGeometry args={[0.08, 10, 10]} />
          </mesh>
        </group>
      );
    default: // Obélisque
      return (
        <group>
          <mesh castShadow material={mat} position={[0, 0.26, 0]}>
            <cylinderGeometry args={[0.03, 0.14, 0.52, 4]} />
          </mesh>
          <mesh material={mat} position={[0, 0.06, 0]}>
            <boxGeometry args={[0.3, 0.1, 0.3]} />
          </mesh>
        </group>
      );
  }
};

/** Taille des pions : assez gros pour se repérer d'un coup d'œil. */
const PAWN_SCALE = 1.62;

/** Distance dont l'étiquette d'un pion rentre vers le centre, en unités monde. */
const LABEL_IN = 2.4;

/*
  Déplacement d'un pion.

  Chaque case franchie est un **bond complet** : décollage, parabole,
  réception. L'implémentation précédente visait la case par amortissement
  exponentiel et ajoutait une hauteur proportionnelle au chemin restant —
  le pion n'atterrissait donc jamais vraiment, il flottait d'un bout à
  l'autre du plateau et on ne pouvait pas compter les cases à l'œil.

  Ici le bond est piloté par une progression bornée : la hauteur vaut zéro
  au départ comme à l'arrivée, le pion touche le plateau à chaque case, et
  c'est ce contact qui rend le déplacement lisible et vivant.
*/

/*
  Durée d'un bond. Elle doit rester **sous** l'intervalle entre deux pas de
  la cinématique (135 ms sur un gros lancer, 175 ms sinon), sans quoi la case
  suivante arrive avant que le pion ait touché le plateau : il ne se poserait
  jamais et on retomberait sur le vol plané d'avant.
*/
const dureeBond = (d: number) => Math.min(0.40, Math.max(0.10, d * 0.062));

/** Hauteur du bond, proportionnée à la distance franchie. */
const hauteurBond = (d: number) => Math.min(1.1, 0.2 + d * 0.18);

const Pawn = ({
  color, token, target, bankrupt, active, labels, id, slot,
}: {
  color: string;
  token: string;
  target: [number, number, number];
  bankrupt: boolean;
  active: boolean;
  /**
   * Étiquettes DOM des prénoms. On résout l'élément à chaque image plutôt
   * qu'au rendu : au premier rendu de la scène, le DOM des étiquettes n'existe
   * pas encore, et une référence capturée resterait nulle pour toujours.
   */
  labels: React.RefObject<Map<PlayerId, HTMLElement | null>>;
  id: PlayerId;
  /** Rang du pion sur sa case : sert à étager les prénoms. */
  slot: number;
}) => {
  const g = useRef<THREE.Group>(null);
  const pos = useRef(new THREE.Vector3(...target));
  const vec = useMemo(() => new THREE.Vector3(), []);
  /** Extrémités et avancement du bond en cours (1 = posé). */
  const depart = useRef(new THREE.Vector3(...target));
  const arrivee = useRef(new THREE.Vector3(...target));
  const avance = useRef(1);
  const duree = useRef(0.15);
  const haut = useRef(0);
  /** Intensité de la réception, de 1 au contact à 0 une fraction de seconde après. */
  const choc = useRef(0);
  const rotCible = useRef(0);
  /** Échelle courante : part de zéro, ce qui fait éclore les pions au lancement. */
  const echelle = useRef(0.001);
  const onde = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.3,
        metalness: 0.15,
        clearcoat: 0.7,
        clearcoatRoughness: 0.2,
        emissive: new THREE.Color(color).multiplyScalar(0.12),
      }),
    [color],
  );
  const matOnde = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        toneMapped: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [color],
  );

  useFrame((st, dt) => {
    if (!g.current) return;
    vec.set(...target);

    // Case changée : on arme un bond entier, depuis la position réellement
    // occupée — si le pion était encore en l'air, il enchaîne sans saccade.
    if (!arrivee.current.equals(vec)) {
      depart.current.copy(pos.current);
      arrivee.current.copy(vec);
      const d = depart.current.distanceTo(vec);
      duree.current = dureeBond(d);
      haut.current = hauteurBond(d);
      avance.current = 0;
      // Demi-tour par bond : le pion pivote d'un pas, il ne tournoie pas.
      rotCible.current += Math.PI;
    }

    let saut = 0;
    let etire = 1;
    if (avance.current < 1) {
      const precedent = avance.current;
      avance.current = Math.min(1, avance.current + dt / duree.current);
      const u = avance.current;
      // Lissage aux deux bouts : le pion s'arrache puis se pose.
      pos.current.lerpVectors(depart.current, arrivee.current, u * u * (3 - 2 * u));
      // Parabole : hauteur nulle aux deux extrémités, maximale à mi-course.
      saut = 4 * u * (1 - u) * haut.current;
      // Étirement en vol : donne l'impression qu'il pousse sur sa base.
      etire = 1 + Math.sin(Math.PI * u) * 0.18;
      if (precedent < 1 && u >= 1) choc.current = 1;
    } else {
      pos.current.copy(arrivee.current);
    }

    // Écrasement à la réception, relâché en un cinquième de seconde.
    if (choc.current > 0) {
      choc.current = Math.max(0, choc.current - dt * 4.5);
      etire *= 1 - choc.current * 0.26;
    }

    // Respiration du joueur actif, uniquement à l'arrêt : superposée au bond,
    // elle ajouterait un tremblement au sommet de la parabole.
    const bob = active && avance.current >= 1 ? Math.sin(st.clock.elapsedTime * 2.6) * 0.03 : 0;
    g.current.position.set(pos.current.x, pos.current.y + saut + bob, pos.current.z);

    if (active && avance.current >= 1) rotCible.current += dt * 0.5;
    g.current.rotation.y += (rotCible.current - g.current.rotation.y) * (1 - Math.pow(0.004, dt));

    // Volume conservé : ce que l'écrasement retire en hauteur, il l'ajoute en largeur.
    const s = (echelle.current += ((bankrupt ? 0.001 : PAWN_SCALE) - echelle.current) * (1 - Math.pow(0.02, dt)));
    const lat = s / Math.sqrt(etire);
    g.current.scale.set(lat, s * etire, lat);

    // Onde de réception : un anneau s'ouvre à l'endroit où le pion se pose.
    if (onde.current) {
      const visible = choc.current > 0.01 && !bankrupt;
      onde.current.visible = visible;
      if (visible) {
        onde.current.scale.setScalar(0.6 + (1 - choc.current) * 1.0);
        matOnde.opacity = choc.current * 0.5;
      }
    }

    // Le prénom suit le pion : on projette sa position dans le repère écran
    // et on déplace l'étiquette DOM. Passer par le DOM garde le texte net,
    // là où une texture 3D le rendrait flou de biais.
    const label = labels.current?.get(id) ?? null;
    if (label) {
      if (bankrupt) {
        label.style.opacity = '0';
      } else {
        // L'étiquette rentre vers le centre du plateau au lieu de se poser
        // sur le pion. Elle restait sinon dans les limites de la case et en
        // masquait le nom. Déborder vers l'extérieur ne marche pas non plus :
        // sur la rangée du bas, l'étiquette passe sous la barre d'action.
        // L'anneau de cases n'a qu'une case de profondeur, donc tout ce qui
        // est vers l'intérieur est de la feutrine vide.
        const px = g.current.position.x;
        const pz = g.current.position.z;
        // Norme de Tchebychev : sur un anneau carré, elle pointe
        // perpendiculairement au bord le plus proche.
        const n = Math.max(Math.abs(px), Math.abs(pz)) || 1;
        vec.set(px - (px / n) * LABEL_IN, 0.5, pz - (pz / n) * LABEL_IN);
        vec.project(st.camera);
        const x = (vec.x * 0.5 + 0.5) * st.size.width;
        const y = (-vec.y * 0.5 + 0.5) * st.size.height;
        // Les prénoms s'étagent verticalement quand plusieurs pions partagent
        // une case : deux étiquettes côte à côte se recouvriraient.
        const etage = slot * 19;
        label.style.transform =
          `translate3d(${Math.round(x)}px, ${Math.round(y - etage)}px, 0) translate(-50%, -50%)`;
        label.style.opacity = vec.z < 1 ? '1' : '0';
      }
    }
  });

  return (
    <group ref={g} name={`pion-${id}`}>
      {/* Socle commun à toutes les silhouettes : un pion de jeu repose sur
          une base tournée, c'est elle qui lui donne son assise. */}
      <mesh castShadow receiveShadow material={mat} position={[0, 0.028, 0]}>
        <cylinderGeometry args={[0.2, 0.23, 0.056, 24]} />
      </mesh>
      <mesh material={mat} position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.14, 0.2, 0.04, 24]} />
      </mesh>
      <group position={[0, 0.06, 0]}>
        <Shape token={token} mat={mat} />
      </group>
      {active && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
          <ringGeometry args={[0.3, 0.38, 28]} />
          <meshBasicMaterial color={color} transparent opacity={0.75} toneMapped={false} />
        </mesh>
      )}
      <mesh ref={onde} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} material={matOnde} visible={false}>
        <ringGeometry args={[0.2, 0.3, 28]} />
      </mesh>
    </group>
  );
};

export const Tokens = ({
  state, tokenTile, activePlayer, labels,
}: {
  state: GameState;
  tokenTile: Record<PlayerId, number>;
  activePlayer: PlayerId | null;
  labels: React.RefObject<Map<PlayerId, HTMLElement | null>>;
}) => {
  // Deux pions sur la même case occupent deux emplacements distincts.
  const slots: Record<PlayerId, number> = {};
  const perTile: Record<number, number> = {};
  const totalOnTile: Record<number, number> = {};
  for (const id of state.order) {
    const t = tokenTile[id] ?? state.players[id].position;
    totalOnTile[t] = (totalOnTile[t] ?? 0) + 1;
  }
  for (const id of state.order) {
    const t = tokenTile[id] ?? state.players[id].position;
    slots[id] = perTile[t] ?? 0;
    perTile[t] = slots[id] + 1;
  }

  return (
    <group>
      {state.order.map((id) => {
        const p = state.players[id];
        const tile = tokenTile[id] ?? p.position;
        const [x, , z] = tokenSlot(tile, slots[id], totalOnTile[tile] ?? 1);
        return (
          <Pawn
            key={id}
            color={p.color}
            token={p.token}
            target={[x, GEO.thickness / 2 + 0.02, z]}
            bankrupt={p.bankrupt}
            active={activePlayer === id}
            labels={labels}
            id={id}
            slot={slots[id]}
          />
        );
      })}
    </group>
  );
};
