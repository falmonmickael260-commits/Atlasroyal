extends SceneTree
func _initialize() -> void: call_deferred("run")
func run() -> void:
 root.size = Vector2i(1280,800)
 var scene = load("res://main.tscn").instantiate()
 root.add_child(scene)
 await process_frame
 scene.orbit = false
 scene.session.seed_demo()
 scene.name_overlay.hide()
 scene.camera_target = Vector3(0,0.4,-3.6)
 scene.distance = 6.2
 scene.pitch = 0.92
 scene.dice_values.assign([3,4])
 scene.dice_total = 7
 scene.turn_phase = "moving"
 scene.travel_stage = "travel"
 scene.moving = true
 await scene.dice_rig.roll_pair(3,4,0.8)
 await create_timer(0.3).timeout
 if DisplayServer.get_name()!="headless":
  await RenderingServer.frame_post_draw
  root.get_texture().get_image().save_png("res://preview-dice.png")
 print("DICE GALLERY: 3 + 4 = 7")
 quit()
