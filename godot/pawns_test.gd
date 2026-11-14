extends SceneTree
func _initialize() -> void: call_deferred("run")
func check(condition: bool, message: String) -> void:
 if not condition:
  push_error(message)
  quit(1)
func run() -> void:
 var scene = load("res://main.tscn").instantiate()
 root.add_child(scene)
 await process_frame
 scene.orbit = false
 var rig = scene.pawns
 check(rig.pieces.size()==8,"Eight distinct pieces required")
 var names := {}
 for piece in rig.pieces:
  names[piece.name] = true
 check(names.size()==8,"Unique names required")
 for i in range(8):
  for j in range(i): check(rig.pieces[i].position.distance_to(rig.pieces[j].position)>0.45,"Shared departure slots overlap")
 for i in range(40): check(rig.sample_track(float(i)).distance_to(rig.track[i])<0.0001,"Curve must cross every tile")
 check(rig.sample_track(39.999).distance_to(rig.sample_track(40.001))<0.02,"Closed route must be continuous")
 var crossed: Array[int] = []
 rig.crossed_tile.connect(func(index: int): crossed.append(index))
 rig.indices[0] = 38
 rig.relayout()
 rig.move_active(5,0.02)
 check(rig.busy,"Motion must lock additional rolls")
 var refused: bool = await rig.move_active(2,0.02)
 check(not refused,"Concurrent motion must be rejected")
 while rig.busy: await process_frame
 check(rig.indices[0]==3,"38 + 5 wraps to 3")
 check(crossed==[39,0,1,2,3],"Crossing events must be exact even at low frame rates")
 for piece in range(1,8):
  check(rig.active==piece,"Each piece must get a turn")
  await rig.move_active(piece+1,0.01)
  check(rig.indices[piece]==piece+1,"Correct arrival required")
 check(rig.active==0,"Turn order must wrap after eight players")
 var before: int = rig.indices[0]
 crossed.clear()
 await rig.move_active(40,0.01)
 check(rig.indices[0]==before,"One full lap must return to start")
 check(crossed.size()==40,"A full lap must emit exactly 40 crossings")
 for i in range(8):
  var expected: Vector3 = rig.track[rig.indices[i]]+rig.slot(i,rig.indices[i])
  check(rig.pieces[i].position.distance_to(expected)<0.001,"Piece must park exactly")
  check(rig.pieces[i].get_node("Sculpture").rotation.length()<0.001,"Piece must settle upright")
 var invalid: bool = await rig.move_active(0)
 check(not invalid,"Zero steps must be rejected")
 print("PAWNS OK: 8 sculptures, shared slots, curve continuity, wrap, 8 turns, full lap, precise parking, concurrent-roll lock")
 quit()
