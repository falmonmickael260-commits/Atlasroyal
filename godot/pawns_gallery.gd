extends SceneTree
func _initialize() -> void: call_deferred("run")
func run() -> void:
 root.size = Vector2i(1600,1000)
 var stage := Node3D.new()
 root.add_child(stage)
 var world := WorldEnvironment.new()
 var env := Environment.new()
 env.background_mode = Environment.BG_COLOR
 env.background_color = Color("091c24")
 env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
 env.ambient_light_color = Color("c6d9df")
 env.ambient_light_energy = 0.65
 world.environment = env
 stage.add_child(world)
 for angle in [-45,135]:
  var light := DirectionalLight3D.new()
  light.rotation_degrees = Vector3(-45,angle,0)
  light.light_color = Color("ffe4b8") if angle<0 else Color("84c7dc")
  light.light_energy = 0.8 if angle<0 else 0.55
  light.shadow_enabled = true
  stage.add_child(light)
 var rig = load("res://pawns.gd").new()
 stage.add_child(rig)
 var positions: Array[Vector3] = []
 for i in range(40): positions.append(Vector3(i*1.8,0,0))
 rig.setup(positions)
 rig.halo.visible = false
 var camera := Camera3D.new()
 stage.add_child(camera)
 camera.position = Vector3(0,7,10.5)
 camera.look_at(Vector3(0,0.5,0))
 camera.fov = 38
 camera.current = true
 var layer := CanvasLayer.new()
 root.add_child(layer)
 var title := Label.new()
 title.text = "ATLAS ROYAL  /  LES HUIT VOYAGEURS"
 title.position = Vector2(55,35)
 title.add_theme_font_size_override("font_size",27)
 title.add_theme_color_override("font_color",Color("dec58e"))
 layer.add_child(title)
 var subtitle := Label.new()
 subtitle.text = "Sculptures 3D originales · pièces métalliques · silhouettes distinctes"
 subtitle.position = Vector2(55,78)
 subtitle.add_theme_font_size_override("font_size",17)
 layer.add_child(subtitle)
 for i in range(8):
  var x := (i%4-1.5)*2.35
  var z := -1.9 if i<4 else 1.8
  rig.pieces[i].position = Vector3(x,0.18,z)
  rig.pieces[i].rotation.y = PI-0.55
  rig.pieces[i].scale = Vector3.ONE*2.3
  rig.disc(stage,Vector3(x,0.02,z),0.9,0.20,rig.material(Color("17333c"),0.3))
  rig.disc(stage,Vector3(x,0.13,z),0.83,0.025,rig.material(rig.COLORS[i],0.55))
  rig.disc(stage,Vector3(x,0.15,z),0.79,0.02,rig.material(Color("1b3037"),0.1))
  var label := Label.new()
  label.text = rig.NAMES[i]
  label.add_theme_font_size_override("font_size",21)
  label.add_theme_color_override("font_color",rig.COLORS[i])
  var screen := camera.unproject_position(Vector3(x,0,z+1.04))
  label.position = screen-Vector2(100,0)
  if i<4: label.position.y = 225
  label.size.x = 200
  label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
  layer.add_child(label)
 await create_timer(1).timeout
 if DisplayServer.get_name()!="headless":
  await RenderingServer.frame_post_draw
  root.get_texture().get_image().save_png("res://preview-pawns.png")
 print("Gallery ready: 8 original sculptures")
 quit()
