extends SceneTree
func _initialize() -> void:
 call_deferred("run")
func run() -> void:
 var scene = load("res://main.tscn").instantiate()
 root.add_child(scene)
 await process_frame
 assert(scene.tiles.size()==40)
 assert(scene.positions.size()==40)
 scene.orbit = false
 await create_timer(1.0).timeout
 if DisplayServer.get_name() != "headless":
  await RenderingServer.frame_post_draw
  root.get_texture().get_image().save_png("res://preview.png")
 scene.roll()
 await create_timer(5.0).timeout
 assert(not scene.moving)
 assert(scene.token_index>0)
 assert(scene.roll_button.disabled==false)
 print("SMOKE OK: 40 cases, lancer terminé, pion déplacé, bouton réactivé")
 quit()
