extends Node3D
# Original procedural art direction. No external assets or network required.
const GOLD = Color("cfb276")
const INK = Color("102e35")
var tiles: Array = []
var positions: Array[Vector3] = []
var camera: Camera3D
var yaw := 0.0
var pitch := 0.80
var distance := 34.0
var orbit := true
var dragging := false
var token: Node3D
var token_index := 0
var moving := false
var detail: Label
var status: Label
var roll_button: Button
var selection: MeshInstance3D
var time := 0.0
var dice: Array[Node3D] = []
var rng := RandomNumberGenerator.new()

func mat(color: Color, metal := 0.0, rough := 0.5, glow := 0.0) -> StandardMaterial3D:
 var m := StandardMaterial3D.new()
 m.cull_mode = BaseMaterial3D.CULL_DISABLED
 m.albedo_color = color
 m.metallic = metal
 m.roughness = rough
 if glow > 0:
  m.emission_enabled = true
  m.emission = color
  m.emission_energy_multiplier = glow
 return m

func mesh(parent: Node3D, shape: Mesh, pos: Vector3, material: Material) -> MeshInstance3D:
 var node := MeshInstance3D.new()
 node.mesh = shape
 node.material_override = material
 node.position = pos
 parent.add_child(node)
 return node

func box(parent: Node3D, pos: Vector3, size: Vector3, material: Material) -> MeshInstance3D:
 var shape := BoxMesh.new()
 shape.size = size
 return mesh(parent, shape, pos, material)

func cylinder(parent: Node3D, pos: Vector3, radius: float, height: float, material: Material, top := -1.0) -> MeshInstance3D:
 var shape := CylinderMesh.new()
 shape.bottom_radius = radius
 shape.top_radius = radius if top < 0 else top
 shape.height = height
 shape.radial_segments = 32
 return mesh(parent, shape, pos, material)

func text3(parent: Node3D, value: String, pos: Vector3, size: int, color: Color, flat := true) -> Label3D:
 var l := Label3D.new()
 l.text = value
 l.font_size = size
 l.pixel_size = 0.007
 l.modulate = color
 l.outline_size = 0
 l.no_depth_test = false
 l.position = pos
 if flat: l.rotation_degrees.x = -90
 parent.add_child(l)
 return l

func _ready() -> void:
 rng.seed = 260
 tiles = JSON.parse_string(FileAccess.get_file_as_string("res://assets/board.json"))
 environment_setup()
 build_board()
 build_center()
 build_tokens()
 build_dice()
 build_ui()
 camera = Camera3D.new()
 camera.fov = 43
 camera.near = 0.1
 camera.far = 150
 add_child(camera)
 camera.current = true
 update_camera()

func environment_setup() -> void:
 var world := WorldEnvironment.new()
 var env := Environment.new()
 env.background_mode = Environment.BG_COLOR
 env.background_color = Color("07161d")
 env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
 env.ambient_light_color = Color("95b5bc")
 env.ambient_light_energy = 0.4
 env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
 world.environment = env
 add_child(world)
 var sun := DirectionalLight3D.new()
 sun.rotation_degrees = Vector3(-52,-25,0)
 sun.light_color = Color("ffe0a9")
 sun.light_energy = 0.9
 sun.shadow_enabled = true
 add_child(sun)
 var fill := DirectionalLight3D.new()
 fill.rotation_degrees = Vector3(-30,145,0)
 fill.light_color = Color("81bed4")
 fill.light_energy = 0.35
 add_child(fill)
 box(self, Vector3(0,-1.2,0),Vector3(200,0.2,200),mat(Color("07151c")))
 # Oversized circular display plinth beneath the square board.
 cylinder(self,Vector3(0,-0.88,0),14.8,0.45,mat(Color("0b2029"),0.5))
 cylinder(self,Vector3(0,-0.63,0),14.35,0.06,mat(Color("123039"),0.5))

func tile_position(i: int) -> Vector3:
 var side := i / 10
 var n := float(i % 10)
 match side:
  0: return Vector3(9.0 - n*1.8,0,9.0)
  1: return Vector3(-9.0,0,9.0-n*1.8)
  2: return Vector3(-9.0+n*1.8,0,-9.0)
  _: return Vector3(9.0,0,-9.0+n*1.8)

func build_board() -> void:
 var brass := mat(GOLD,0.8,0.3)
 box(self,Vector3(0,-0.3,0),Vector3(21.2,0.55,21.2),mat(Color("0a1c24"),0.5))
 box(self,Vector3(0,0.0,0),Vector3(20.9,0.10,20.9),brass)
 box(self,Vector3(0,0.08,0),Vector3(20.65,0.13,20.65),mat(INK,0.2))
 box(self,Vector3(0,0.19,0),Vector3(15.9,0.12,15.9),brass)
 box(self,Vector3(0,0.27,0),Vector3(15.7,0.10,15.7),mat(Color("123b43"),0.15))
 for i in range(40):
  var t: Dictionary = tiles[i]
  var p := tile_position(i)
  positions.append(p)
  var root := Node3D.new()
  root.position = p
  root.rotation.y = -float(i / 10)*PI/2.0
  add_child(root)
  var c := Color(t.color)
  box(root,Vector3(0,0.24,0),Vector3(1.72,0.25,1.72),mat(Color("e7dfc9"),0.12,0.7))
  box(root,Vector3(0,0.39,-0.65),Vector3(1.70,0.06,0.30),mat(c,0.4))
  text3(root,str(t.name).to_upper().replace(" ","\n") if str(t.name).length()>14 else str(t.name).to_upper(),Vector3(0,0.38,0.42),17,INK)
  if t.kind == "city":
   text3(root,"%s €" % t.price,Vector3(0,0.39,0.75),15,Color("73634b"))
   landmark(root,str(t.landmark),c,i)
  else:
   text3(root,{"depart":"➜","card":"?","hub":"✦","tax":"€","prison":"II","parc":"✧","gotoprison":"!","reseau":"+"}.get(str(t.kind),"◆"),Vector3(0,0.42,-0.14),65,c)
  var body := StaticBody3D.new()
  body.set_meta("tile",i)
  var collision := CollisionShape3D.new()
  var shape := BoxShape3D.new()
  shape.size = Vector3(1.75,1.8,1.75)
  collision.shape = shape
  collision.position.y = 0.6
  body.add_child(collision)
  root.add_child(body)
 # Gold corner studs, like a luxury board-game case.
 for x in [-10.15,10.15]:
  for z in [-10.15,10.15]: cylinder(self,Vector3(x,0.2,z),0.09,0.04,brass)
 selection = box(self,Vector3(9,0.13,9),Vector3(1.83,0.05,1.83),mat(Color("7fffe3"),0.4,0.4,1.3))

func landmark(root: Node3D, kind: String, color: Color, index: int) -> void:
 var ivory := mat(Color("eee9d8"),0.15,0.45)
 var accent := mat(color,0.5,0.28)
 var brass := mat(GOLD,0.75,0.3)
 var base := Vector3(0,0.42,-0.16)
 cylinder(root,base,0.43,0.08,brass)
 if kind == "pyramid":
  var cone := cylinder(root,base+Vector3(0,0.32,0),0.4,0.65,ivory,0)
  cone.mesh = cone.mesh.duplicate()
  cone.mesh.radial_segments = 4
  cone.rotation.y = PI/4
 elif kind == "dome":
  cylinder(root,base+Vector3(0,0.22,0),0.30,0.38,ivory)
  var sphere := SphereMesh.new()
  sphere.radius = 0.31
  sphere.height = 0.62
  mesh(root,sphere,base+Vector3(0,0.42,0),accent).scale.y = 0.65
  cylinder(root,base+Vector3(0,0.72,0),0.025,0.3,brass,0)
 elif kind == "arch" or kind == "bridge":
  for x in [-0.3,0.3]:
   box(root,base+Vector3(x,0.30,0),Vector3(0.16,0.60,0.24),ivory)
  box(root,base+Vector3(0,0.58,0),Vector3(0.80,0.16,0.27),accent)
  box(root,base+Vector3(0,0.72,0),Vector3(0.84,0.10,0.30),brass)
 elif kind == "pagoda":
  for level in range(3):
   var w := 0.68-float(level)*0.15
   box(root,base+Vector3(0,0.12+level*0.23,0),Vector3(w*0.65,0.21,w*0.65),ivory)
   cylinder(root,base+Vector3(0,0.25+level*0.23,0),w*0.7,0.15,accent,0.08).mesh.radial_segments = 4
 else:
  for j in range(3):
   var h := 0.36 + float((index+j*3)%7)*0.12
   var x := float(j-1)*0.25
   box(root,base+Vector3(x,h/2,0),Vector3(0.21,h,0.27),ivory if j != 1 else accent)
   for k in range(int(h/0.14)):
    box(root,base+Vector3(x,0.08+k*0.14,0.142),Vector3(0.13,0.025,0.01),brass)
  if kind == "spire" or kind == "tower":
   cylinder(root,base+Vector3(0,1.05,0),0.035,0.6,brass,0)

func build_center() -> void:
 var gold := mat(GOLD,0.8,0.3)
 # Concentric inlaid rings and compass rose.
 for radius in [2.1,2.2,5.7,5.76,6.5]:
  var ring := TorusMesh.new()
  ring.inner_radius = radius-0.015
  ring.outer_radius = radius+0.015
  mesh(self,ring,Vector3(0,0.34,0),gold)
 for i in range(32):
  var a := TAU*float(i)/32
  var tick := box(self,Vector3(sin(a)*5.45,0.34,cos(a)*5.45),Vector3(0.025,0.015,0.32 if i%4==0 else 0.13),gold)
  tick.rotation.y = a
 for i in range(8):
  var rose := ImmediateMesh.new()
  rose.surface_begin(Mesh.PRIMITIVE_TRIANGLES)
  var length := 2.8 if i%2==0 else 1.8
  rose.surface_add_vertex(Vector3(0,0,0))
  rose.surface_add_vertex(Vector3(length,0,0))
  rose.surface_add_vertex(Vector3(0.6,0,-0.32))
  rose.surface_add_vertex(Vector3(0,0,0))
  rose.surface_add_vertex(Vector3(0.6,0,0.32))
  rose.surface_add_vertex(Vector3(length,0,0))
  rose.surface_end()
  var needle := mesh(self,rose,Vector3(0,0.38,0),gold)
  needle.rotation.y = TAU*float(i)/8
 cylinder(self,Vector3(0,0.45,0),0.45,0.12,gold)
 text3(self,"ATLAS  ROYAL",Vector3(0,0.36,3.25),96,Color("efdbab"))
 text3(self,"L E   G R A N D   T O U R",Vector3(0,0.36,4.15),25,GOLD)
 text3(self,"N",Vector3(0,0.36,-5.05),40,GOLD)
 # Layered travel cards.
 for side in [-1,1]:
  for j in range(4):
   var card := box(self,Vector3(side*4.3,0.4+j*0.045,-2.3),Vector3(1.3,0.04,1.9),mat(Color("1c4c56") if side<0 else Color("bda06c"),0.2))
   card.rotation.y = side*0.15+j*0.025
  text3(self,"DESTIN" if side<0 else "MARCHÉ",Vector3(side*4.3,0.60,-2.3),23,Color("f4e7c7"))

func build_tokens() -> void:
 for i in range(4):
  var pawn := Node3D.new()
  add_child(pawn)
  pawn.position = tile_position(i*10)+Vector3(0,0.4,0)
  var m := mat([Color("f4cb78"),Color("81e4ce"),Color("d386a4"),Color("91b8e4")][i],0.75,0.22)
  cylinder(pawn,Vector3(0,0.08,0),0.22,0.15,m)
  cylinder(pawn,Vector3(0,0.38,0),0.13,0.50,m,0.065)
  var sphere := SphereMesh.new()
  sphere.radius = 0.14
  sphere.height = 0.28
  mesh(pawn,sphere,Vector3(0,0.70,0),m)
  if i==0: token = pawn

func build_dice() -> void:
 for i in range(2):
  var die := Node3D.new()
  die.position = Vector3(-0.65+i*1.3,0.82,-3.6)
  die.rotation.y = 0.2-i*0.4
  add_child(die)
  dice.append(die)
  box(die,Vector3.ZERO,Vector3(0.75,0.75,0.75),mat(Color("ece3ce"),0.1,0.35))
  # Opposite faces sum to seven. X/Z points are in the face plane.
  var normals := [Vector3.UP,Vector3.DOWN,Vector3.RIGHT,Vector3.LEFT,Vector3.FORWARD,Vector3.BACK]
  var values := [1,6,3,4,2,5]
  for face in range(6):
   var normal: Vector3 = normals[face]
   var u := Vector3.RIGHT if abs(normal.y)>0.5 else Vector3.UP
   var v := normal.cross(u)
   var points: Array[Vector2] = []
   var value: int = values[face]
   if value%2==1: points.append(Vector2.ZERO)
   if value>=2: points.append_array([Vector2(-1,-1),Vector2(1,1)])
   if value>=4: points.append_array([Vector2(-1,1),Vector2(1,-1)])
   if value==6: points.append_array([Vector2(-1,0),Vector2(1,0)])
   for pt in points:
    var sphere := SphereMesh.new()
    sphere.radius = 0.047
    sphere.height = 0.094
    mesh(die,sphere,normal*0.376+u*pt.x*0.19+v*pt.y*0.19,mat(INK))

func label_at(parent: Control, value: String, pos: Vector2, size: int, color: Color) -> Label:
 var l := Label.new()
 l.text = value
 l.position = pos
 l.add_theme_font_size_override("font_size",size)
 l.add_theme_color_override("font_color",color)
 parent.add_child(l)
 return l

func build_ui() -> void:
 var layer := CanvasLayer.new()
 add_child(layer)
 var ui := Control.new()
 ui.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
 ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
 layer.add_child(ui)
 label_at(ui,"A / R",Vector2(42,28),26,GOLD)
 label_at(ui,"ATLAS ROYAL",Vector2(42,65),14,Color("eef0e8"))
 label_at(ui,"LE GRAND TOUR  /  ÉTUDE DE PLATEAU",Vector2(42,91),11,Color("91aaa9"))
 var top := Label.new()
 top.text = "COLLECTION 01     •     40 ESCALES     •     GODOT 4"
 top.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
 top.position = Vector2(-480,42)
 top.add_theme_font_size_override("font_size",12)
 top.add_theme_color_override("font_color",GOLD)
 ui.add_child(top)
 var panel := PanelContainer.new()
 panel.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
 panel.offset_left = 32
 panel.offset_right = -32
 panel.offset_top = -115
 panel.offset_bottom = -25
 var style := StyleBoxFlat.new()
 style.bg_color = Color(0.025,0.075,0.09,0.95)
 style.border_color = Color("516057")
 style.set_border_width_all(1)
 style.set_corner_radius_all(10)
 style.content_margin_left = 24
 style.content_margin_right = 24
 panel.add_theme_stylebox_override("panel",style)
 ui.add_child(panel)
 var row := HBoxContainer.new()
 row.add_theme_constant_override("separation",24)
 panel.add_child(row)
 var column := VBoxContainer.new()
 column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
 column.alignment = BoxContainer.ALIGNMENT_CENTER
 row.add_child(column)
 status = Label.new()
 status.text = "EXPLOREZ VOTRE EMPIRE"
 status.add_theme_color_override("font_color",GOLD)
 column.add_child(status)
 detail = Label.new()
 detail.text = "Cliquez sur une ville pour découvrir son escale."
 detail.add_theme_font_size_override("font_size",14)
 column.add_child(detail)
 for title in ["Vue cinéma","Vue du dessus","Lancer les dés"]:
  var button := Button.new()
  button.text = title
  button.custom_minimum_size = Vector2(165,48)
  button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
  var s := StyleBoxFlat.new()
  s.bg_color = Color("bda374") if title=="Lancer les dés" else Color("193b43")
  s.set_corner_radius_all(6)
  s.content_margin_left = 16
  s.content_margin_right = 16
  button.add_theme_stylebox_override("normal",s)
  button.add_theme_color_override("font_color",INK if title=="Lancer les dés" else Color("e9e1ce"))
  row.add_child(button)
  if title=="Vue cinéma": button.pressed.connect(func(): orbit = not orbit)
  elif title=="Vue du dessus": button.pressed.connect(func(): orbit = false; pitch = 1.48; yaw = 0; distance = 29)
  else:
   roll_button = button
   button.pressed.connect(roll)
 var hint := Label.new()
 hint.text = "GLISSER POUR TOURNER   /   MOLETTE POUR ZOOMER   /   ESPACE : DÉS   /   R : VUE INITIALE"
 hint.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
 hint.position = Vector2(42,-145)
 hint.add_theme_font_size_override("font_size",11)
 hint.add_theme_color_override("font_color",Color("93aaa8"))
 ui.add_child(hint)

func update_camera() -> void:
 camera.position = Vector3(sin(yaw)*cos(pitch),sin(pitch),cos(yaw)*cos(pitch))*distance
 camera.look_at(Vector3(0,0.15,0))

func _process(delta: float) -> void:
 time += delta
 if orbit and not dragging: yaw += delta*0.045
 update_camera()
 if selection: selection.position.y = 0.15+sin(time*2)*0.025

func _unhandled_input(event: InputEvent) -> void:
 if event is InputEventMouseButton:
  if event.button_index == MOUSE_BUTTON_RIGHT: dragging = event.pressed; orbit = false
  if event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_UP: distance = max(15.0,distance-1.5)
  if event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_DOWN: distance = min(45.0,distance+1.5)
  if event.pressed and event.button_index == MOUSE_BUTTON_LEFT: pick(event.position)
 if event is InputEventMouseMotion and dragging:
  yaw -= event.relative.x*0.006
  pitch = clamp(pitch+event.relative.y*0.005,0.35,1.5)
 if event is InputEventKey and event.pressed:
  if event.keycode == KEY_SPACE: roll()
  if event.keycode == KEY_R: yaw = 0; pitch = 0.80; distance = 34; orbit = true

func pick(screen: Vector2) -> void:
 var from := camera.project_ray_origin(screen)
 var query := PhysicsRayQueryParameters3D.create(from,from+camera.project_ray_normal(screen)*100)
 var hit := get_world_3d().direct_space_state.intersect_ray(query)
 if hit and hit.collider.has_meta("tile"):
  var i: int = hit.collider.get_meta("tile")
  var t: Dictionary = tiles[i]
  selection.position = positions[i]+Vector3(0,0.15,0)
  status.text = str(t.name).to_upper()
  detail.text = "%s  •  %s €  •  Escale %02d / 40" % [t.get("country","Grand Tour"), t.price, i+1] if t.kind=="city" else "Escale spéciale  •  " + str(t.name)

func roll() -> void:
 if moving: return
 moving = true
 roll_button.disabled = true
 var a := rng.randi_range(1,6)
 var b := rng.randi_range(1,6)
 status.text = "LE VOYAGE COMMENCE…"
 detail.text = "Lancer en cours"
 var tween := create_tween().set_parallel(true)
 # Face orientations correspond to the actual pip geometry above.
 var faces := [Vector3.ZERO,Vector3(PI/2,0,0),Vector3(0,0,PI/2),Vector3(0,0,-PI/2),Vector3(-PI/2,0,0),Vector3(PI,0,0)]
 for i in range(2):
  var value := a if i==0 else b
  var target: Vector3 = faces[value-1]+Vector3(TAU*2,0,TAU*2)
  dice[i].rotation = Vector3.ZERO
  tween.tween_property(dice[i],"rotation",target,0.85).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
 await tween.finished
 detail.text = "%d + %d = %d cases" % [a,b,a+b]
 for step in range(a+b):
  token_index = (token_index+1)%40
  var target := positions[token_index]+Vector3(0,0.4,0)
  var hop := create_tween()
  hop.tween_property(token,"position",target+Vector3(0,0.6,0),0.12)
  hop.tween_property(token,"position",target,0.10)
  await hop.finished
 selection.position = positions[token_index]+Vector3(0,0.15,0)
 status.text = str(tiles[token_index].name).to_upper()
 detail.text = "Arrivée  •  %d + %d  •  Démonstration visuelle, sans règles économiques" % [a,b]
 moving = false
 roll_button.disabled = false
