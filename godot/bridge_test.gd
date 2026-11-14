extends SceneTree
func _initialize() -> void: call_deferred("run")
func run() -> void:
 var scene = load("res://main.tscn").instantiate()
 root.add_child(scene)
 await process_frame
 var bridge = load("res://live_renderer.gd").new()
 scene.add_child(bridge)
 bridge.setup(scene)
 var fixture := {"type":"fortune-state","state":{"order":["alice","bob"],"currentIndex":0,"players":{"alice":{"token":"t1","position":1,"bankrupt":false},"bob":{"token":"t2","position":2,"bankrupt":false}},"tiles":{"1":{"owner":"alice","level":3},"3":{"owner":"alice","level":5}}},"cinema":{"tokenTile":{"alice":1,"bob":2},"dice":{"values":[2,6],"key":1,"rolling":true}}}
 bridge.apply_frame(fixture)
 await create_timer(1.0).timeout
 assert(scene.pawns.pieces[0].visible and scene.pawns.pieces[1].visible)
 assert(not scene.pawns.pieces[2].visible)
 assert(bridge.building_levels[1]==3 and bridge.building_levels[3]==5)
 assert(scene.session.owners[1]==0)
 assert(scene.dice_rig.top_values()==[2,6])
 assert(not scene.orbit and scene.yaw==0 and not scene.trading.visible)
 fixture.cinema.tokenTile.alice = 2
 bridge.apply_frame(fixture)
 await create_timer(0.25).timeout
 bridge.apply_frame(fixture)
 assert(scene.pawns.indices[0]==2)
 assert(scene.pawns.pieces[0].position.distance_to(scene.pawns.pieces[1].position)>0.4)
 assert(not scene.orbit and scene.yaw==0)
 print("LIVE RENDERER: PASS · original state, pieces, dice, houses, hotel and fixed camera")
 quit()
