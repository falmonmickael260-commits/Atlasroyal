extends SceneTree
func _initialize() -> void:
 call_deferred("run")
func run() -> void:
 var scene = load("res://main.tscn").instantiate()
 root.size = Vector2i(1600,1000)
 root.add_child(scene)
 await process_frame
 assert(scene.tiles.size()==40)
 for i in range(40): assert(FileAccess.file_exists("res://assets/cases/%02d.svg" % i))
 assert(scene.positions.size()==40)
 scene.orbit = false
 await create_timer(1.0).timeout
 if DisplayServer.get_name() != "headless":
  await RenderingServer.frame_post_draw
  root.get_texture().get_image().save_png("res://preview.png")
  scene.set_process(false)
  var transform_before: Transform3D = scene.camera.transform
  scene.camera.position = Vector3(2,7,15)
  scene.camera.look_at(Vector3(1,0,8))
  await RenderingServer.frame_post_draw
  root.get_texture().get_image().save_png("res://preview-cases.png")
  scene.camera.transform = transform_before
  scene.set_process(true)
 # Verify the tablet-width desktop layout too.
 root.size = Vector2i(1280,800)
 await process_frame
 await process_frame
 scene.update_responsive_ui()
 scene.update_camera()
 root.size = Vector2i(1600,1000)
 await process_frame
 # Check portrait UI without squeezing all 22 names onto a phone.
 root.size = Vector2i(390,844)
 await process_frame
 await process_frame
 scene.update_responsive_ui()
 scene.select_tile(14)
 scene.update_camera()
 assert(scene.footer_grid.columns==1)
 assert(scene.tile_picker.item_count==41)
 assert(scene.footer_panel.get_combined_minimum_size().x<=358, "Footer too wide for phone")
 assert(scene.status.text=="RIO DE JANEIRO")
 if DisplayServer.get_name() != "headless":
  await RenderingServer.frame_post_draw
  root.get_texture().get_image().save_png("res://preview-mobile.png")
 root.size = Vector2i(1600,1000)
 await process_frame
 scene.update_responsive_ui()
 var globe_before: float = scene.animated_globe.rotation.y
 var airship_before: Vector3 = scene.airship.position
 scene.roll()
 while scene.moving: await process_frame
 assert(scene.animated_globe.rotation.y>globe_before)
 assert(scene.airship.position.distance_to(airship_before)>0.01)
 assert(scene.traffic.size()==3)
 assert(not scene.moving)
 assert(scene.token_index>0)
 assert(scene.roll_button.disabled==false)
 scene.focus_tile()
 assert(scene.camera_target==scene.positions[14])
 assert(scene.distance==8.5)
 print("SMOKE OK: 40 cases, noms intégrés aux cases, interface 390x844, lancer et déplacement terminés")
 quit()
