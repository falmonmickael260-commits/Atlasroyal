extends SceneTree
func _initialize() -> void: call_deferred("run")
func run() -> void:
 var scene = load("res://main.tscn").instantiate()
 scene.set_meta("renderer_only",true)
 root.add_child(scene)
 var bridge = load("res://live_renderer.gd").new()
 scene.add_child(bridge)
 bridge.setup(scene)
 var frame := {"state":{"order":["a","b"],"currentIndex":0,"players":{"a":{"token":"t2","position":38,"bankrupt":false},"b":{"token":"t1","position":3,"bankrupt":false}},"tiles":{}},"cinema":{"tokenTile":{"a":38,"b":3},"playing":true,"follow":38}}
 bridge.apply_frame(frame)
 var node: Node3D = scene.pawns.pieces[1]
 for step in range(1,6):
  var tile := posmod(38+step,40)
  frame.cinema.tokenTile.a = tile
  frame.cinema.travel = {"player":"a","from":posmod(tile-1,40),"to":tile,"step":step,"total":5,"duration":0.10}
  var before: Vector3 = node.position
  bridge.apply_frame(frame)
  assert(node.position.distance_to(before)<0.001,"New step must not snap back to its previous target")
  var tween = bridge.motion.a
  bridge.apply_frame(frame)
  assert(bridge.motion.a==tween,"Duplicate snapshots must not restart motion")
  # Interrupt early to reproduce slow renderer frames / closely spaced steps.
  await create_timer(0.055 if step<5 else 0.30).timeout
 assert(scene.pawns.indices[1]==3)
 assert(node.position.distance_to(scene.pawns.track[3]+scene.pawns.slot(1,3))<0.001,"Arriving piece parks exactly")
 assert(node.position.distance_to(scene.pawns.pieces[0].position)>0.45,"Shared landing has distinct slots")
 assert(node.get_node("Sculpture").rotation.length()<0.001)
 assert(node.get_node("Sculpture").position.length()<0.001)
 # A card moving backwards must visit the reverse route, not teleport.
 for step in range(1,4):
  frame.cinema.tokenTile.a = 3-step
  frame.cinema.travel = {"player":"a","from":4-step,"to":3-step,"step":step,"total":3,"duration":0.08}
  bridge.apply_frame(frame)
  await create_timer(0.12).timeout
 assert(bridge.progress.a==40.0)
 assert(node.position.distance_to(scene.pawns.track[0]+scene.pawns.slot(1,0))<0.001)
 # Reduced motion and authoritative corrections remain exact.
 frame.reduced = true
 frame.cinema.tokenTile.a = 1
 frame.cinema.travel = {"player":"a","from":0,"to":1,"step":1,"total":1,"duration":0.175}
 bridge.apply_frame(frame)
 await create_timer(0.10).timeout
 assert(node.position.distance_to(scene.pawns.track[1])<0.001)
 frame.cinema.travel = null
 frame.cinema.tokenTile.a = 10
 bridge.apply_frame(frame)
 assert(node.position.distance_to(scene.pawns.track[10])<0.001,"Direct transfer must stay direct")
 assert(not scene.orbit and scene.yaw==0)
 print("MOTION PASS: interrupted steps, duplicates, wrap, shared arrival, reverse card route, reduced motion and direct transfer")
 quit()
