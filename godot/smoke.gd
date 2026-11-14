extends SceneTree
func _initialize() -> void:
 call_deferred("run")
func run() -> void:
 var scene = load("res://main.tscn").instantiate()
 root.size = Vector2i(1600,1000)
 root.add_child(scene)
 await process_frame
 assert(scene.tiles.size()==40)
 assert(scene.positions.size()==40)
 assert(scene.city_labels.size()==22)
 scene.orbit = false
 for angle in [0.0, PI/2, PI, 3*PI/2]:
  scene.yaw = angle
  scene.update_camera()
  scene.update_city_labels()
  var rects: Array[Rect2] = []
  for entry in scene.city_labels:
   var panel: PanelContainer = entry.panel
   var rect := Rect2(panel.position,panel.size)
   for other in rects:
    if rect.intersects(other):
     print("OVERLAP ",angle," view=",root.size," rect=",rect," other=",other)
     quit(1)
     return
   rects.append(rect)
 scene.yaw = 0
 scene.update_camera()
 scene.update_city_labels()
 await create_timer(1.0).timeout
 if DisplayServer.get_name() != "headless":
  await RenderingServer.frame_post_draw
  root.get_texture().get_image().save_png("res://preview.png")
 # Verify the tablet-width desktop layout too.
 root.size = Vector2i(1280,800)
 await process_frame
 await process_frame
 scene.update_responsive_ui()
 scene.update_camera()
 scene.update_city_labels()
 var tablet_rects: Array[Rect2] = []
 for entry in scene.city_labels:
  var panel: PanelContainer = entry.panel
  var rect := Rect2(panel.position,panel.size)
  for other in tablet_rects: assert(not rect.intersects(other), "Tablet labels overlap")
  tablet_rects.append(rect)
 root.size = Vector2i(1600,1000)
 await process_frame
 # Check portrait UI without squeezing all 22 names onto a phone.
 root.size = Vector2i(390,844)
 await process_frame
 await process_frame
 scene.update_responsive_ui()
 scene.select_tile(14)
 scene.update_camera()
 scene.update_city_labels()
 assert(scene.footer_grid.columns==1)
 assert(scene.tile_picker.item_count==41)
 assert(scene.footer_panel.get_combined_minimum_size().x<=358, "Footer too wide for phone")
 var visible_names := 0
 for entry in scene.city_labels:
  if entry.panel.visible: visible_names += 1
 assert(visible_names==1)
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
 await create_timer(5.0).timeout
 assert(scene.animated_globe.rotation.y>globe_before)
 assert(scene.airship.position.distance_to(airship_before)>0.01)
 assert(scene.traffic.size()==3)
 assert(not scene.moving)
 assert(scene.token_index>0)
 assert(scene.roll_button.disabled==false)
 print("SMOKE OK: 40 cases, 22 noms sans chevauchement sur 4 angles, interface 390x844, lancer et déplacement terminés")
 quit()
