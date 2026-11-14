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
var camera_target := Vector3.ZERO
var orbit := false
var dragging := false
var token: Node3D
var pawns: Node3D
var renderer_mode := false
var legacy_ui: Control
var owner_markers: Dictionary = {}
var session: RefCounted
var trading: CanvasLayer
var turn_phase := "roll"
var follow_pawn := false
var saved_camera: Dictionary = {}
var token_index := 0
var moving := false
var detail: Label
var status: Label
var roll_button: Button
var selection: MeshInstance3D
var time := 0.0
var dice: Array[Node3D] = []
var dice_rig: Node3D
var dice_values: Array[int] = [0,0]
var dice_total := 0
var steps_moved := 0
var travel_stage := ""
var rng := RandomNumberGenerator.new()
var city_labels: Array[Dictionary] = []
var name_overlay: Control
var footer_panel: PanelContainer
var footer_grid: GridContainer
var footer_buttons: Array[Button] = []
var footer_hint: Label
var collection_label: Label
var tile_picker: OptionButton
var selected_tile := -1
var last_viewport_size := Vector2.ZERO
var animated_globe: Node3D
var airship: Node3D
var traffic: Array[Node3D] = []
var motes: Array[MeshInstance3D] = []
var sails: Array[Node3D] = []
var header_labels: Array[Label] = []

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
 shape.radial_segments = 96 if radius>5 else 32
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
 build_living_world()
 build_ui()
 camera = Camera3D.new()
 camera.fov = 43
 camera.near = 0.1
 camera.far = 150
 add_child(camera)
 camera.current = true
 update_camera()
 build_city_labels()
 update_city_labels()
 session = load("res://trade_state.gd").new()
 session.setup(tiles,pawns.NAMES)
 session.changed.connect(refresh_ownership)
 trading = load("res://trade_ui.gd").new()
 add_child(trading)
 trading.setup(self,session)
 legacy_ui.hide()
 if OS.has_feature("web") and str(JavaScriptBridge.get_interface("window").location.search).contains("renderer=1"):
  var bridge = load("res://live_renderer.gd").new()
  add_child(bridge)
  bridge.setup(self)

func environment_setup() -> void:
 var world := WorldEnvironment.new()
 var env := Environment.new()
 env.background_mode = Environment.BG_COLOR
 env.background_color = Color("07161d")
 env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
 env.ambient_light_color = Color("95b5bc")
 env.ambient_light_energy = 0.28
 env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
 world.environment = env
 add_child(world)
 var sun := DirectionalLight3D.new()
 sun.rotation_degrees = Vector3(-52,-25,0)
 sun.light_color = Color("f1e6d0")
 sun.light_energy = 0.48
 sun.shadow_enabled = true
 add_child(sun)
 var fill := DirectionalLight3D.new()
 fill.rotation_degrees = Vector3(-30,145,0)
 fill.light_color = Color("81bed4")
 fill.light_energy = 0.18
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

func wrapped_name(value: String) -> String:
 var lines := PackedStringArray()
 var line := ""
 for word in value.to_upper().split(" "):
  if not line.is_empty() and (line+" "+word).length()>10:
   lines.append(line)
   line = word
  else:
   line = word if line.is_empty() else line+" "+word
 lines.append(line)
 return "\n".join(lines)

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
  box(root,Vector3(0,0.21,0),Vector3(1.74,0.23,1.74),mat(Color("101f25"),0.35,0.65))
  box(root,Vector3(0,0.332,0),Vector3(1.72,0.035,1.72),brass)
  var face := PlaneMesh.new()
  face.size = Vector2(1.67,1.67)
  var ink := StandardMaterial3D.new()
  ink.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
  ink.albedo_texture = load("res://assets/cases/%02d.svg" % i)
  ink.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
  mesh(root,face,Vector3(0,0.355,0),ink)
  if t.kind == "city":
   landmark(root,str(t.landmark),c,i)
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

func rod(parent: Node3D, a: Vector3, b: Vector3, radius: float, material: Material) -> void:
 var d := b-a
 var node := cylinder(parent,(a+b)/2,radius,d.length(),material)
 if abs(d.normalized().dot(Vector3.UP))<0.999:
  node.quaternion = Quaternion(Vector3.UP,d.normalized())

func landmark(root: Node3D, kind: String, color: Color, index: int) -> void:
 var ivory := mat(Color("b5b4a0"),0.1,0.8)
 var accent := mat(color.darkened(0.2),0.35,0.55)
 var brass := mat(GOLD.darkened(0.15),0.65,0.4)
 var glass := mat(Color("324f58"),0.5,0.25)
 var model := Node3D.new()
 root.add_child(model)
 model.position = Vector3(0,0.38,-0.15)
 # A terraced stone plaza keeps miniature architecture separate from lettering.
 box(model,Vector3(0,0.02,0),Vector3(0.91,0.045,0.69),brass)
 box(model,Vector3(0,0.055,0),Vector3(0.84,0.045,0.62),ivory)
 if index==3:
  for j in range(3):
   var pyramid := cylinder(model,Vector3(-0.28+j*0.28,0.22+j*0.07,0.03),0.24,0.3+j*0.14,ivory,0)
   pyramid.mesh.radial_segments = 4
   pyramid.rotation.y = PI/4
 elif index==14:
  cylinder(model,Vector3(0,0.21,0),0.22,0.25,ivory,0.15)
  box(model,Vector3(0,0.53,0),Vector3(0.11,0.43,0.12),ivory)
  box(model,Vector3(0,0.65,0),Vector3(0.65,0.07,0.09),ivory)
  cylinder(model,Vector3(0,0.82,0),0.075,0.14,ivory)
 elif index==34:
  for x in [-0.28,0.0,0.28]:
   box(model,Vector3(x,0.40,0),Vector3(0.18,0.62,0.31),glass)
   for y in range(6): box(model,Vector3(x,0.13+y*0.10,0.161),Vector3(0.17,0.015,0.013),brass)
  box(model,Vector3(0,0.75,0),Vector3(0.98,0.11,0.35),ivory)
  box(model,Vector3(0,0.815,0),Vector3(0.65,0.025,0.22),mat(Color("4b897d"),0.3,0.2))
 elif index==37:
  for level in range(7):
   var h := 0.12
   var w := 0.40-float(level)*0.045
   box(model,Vector3(0,0.12+level*h,0),Vector3(w,h,w),glass)
   box(model,Vector3(0,0.18+level*h,0),Vector3(w+0.015,0.012,w+0.015),brass)
  cylinder(model,Vector3(0,1.13,0),0.025,0.38,brass,0)
 elif index==26:
  box(model,Vector3(0,0.43,0),Vector3(0.30,0.70,0.30),ivory)
  box(model,Vector3(0,0.84,0),Vector3(0.40,0.16,0.40),brass)
  for x in [-0.1,0,0.1]: box(model,Vector3(x,0.4,0.156),Vector3(0.023,0.48,0.012),glass)
  var clock := cylinder(model,Vector3(0,0.85,0.21),0.066,0.012,mat(Color("e8dcb9")))
  clock.rotation.x = PI/2
  rod(model,Vector3(0,0.85,0.22),Vector3(0.04,0.87,0.22),0.006,glass)
  cylinder(model,Vector3(0,1.04,0),0.25,0.25,accent,0).mesh.radial_segments = 4
 elif index==31:
  for j in [-1,1]:
   rod(model,Vector3(j*0.31,0.08,0),Vector3(0,1.05,0),0.028,accent)
   rod(model,Vector3(j*0.18,0.08,-0.20),Vector3(0,1.05,0),0.024,accent)
  for level in range(4):
   var w := 0.56-level*0.11
   box(model,Vector3(0,0.2+level*0.2,0),Vector3(w,0.045,w*0.7),ivory)
  cylinder(model,Vector3(0,1.1,0),0.015,0.25,brass,0)
 elif kind=="bridge":
  box(model,Vector3(0,0.16,0),Vector3(0.87,0.12,0.43),glass)
  for x in [-0.28,0.28]:
   box(model,Vector3(x,0.35,0),Vector3(0.11,0.57,0.16),accent)
   for end in [-0.43,0,0.43]: rod(model,Vector3(x,0.64,0),Vector3(end,0.23,0),0.008,brass)
  box(model,Vector3(0,0.23,0),Vector3(0.96,0.045,0.22),ivory)
 elif kind=="arch":
  for x in [-0.34,0.34]:
   box(model,Vector3(x,0.33,0),Vector3(0.20,0.50,0.29),ivory)
   box(model,Vector3(x,0.61,0),Vector3(0.24,0.07,0.34),accent)
   for k in range(3): box(model,Vector3(x-0.075+k*0.075,0.68,0),Vector3(0.035,0.09,0.30),ivory)
  for k in range(9):
   var a := PI*k/8
   var block := box(model,Vector3(cos(a)*0.24,0.35+sin(a)*0.24,0),Vector3(0.095,0.10,0.26),ivory)
   block.rotation.z = a-PI/2
 elif kind=="dome":
  cylinder(model,Vector3(0,0.23,0),0.30,0.30,ivory)
  var sphere := SphereMesh.new()
  sphere.radius = 0.31
  sphere.height = 0.62
  mesh(model,sphere,Vector3(0,0.40,0),accent).scale.y = 0.65
  for j in range(12):
   var a := TAU*j/12
   cylinder(model,Vector3(sin(a)*0.29,0.24,cos(a)*0.29),0.022,0.27,brass)
  for x in [-0.38,0.38]:
   cylinder(model,Vector3(x,0.4,0),0.045,0.66,ivory)
   cylinder(model,Vector3(x,0.8,0),0.07,0.18,accent,0)
 elif kind=="pagoda":
  for level in range(4):
   var w := 0.70-level*0.13
   box(model,Vector3(0,0.15+level*0.18,0),Vector3(w*0.65,0.16,w*0.65),ivory)
   var roof := cylinder(model,Vector3(0,0.25+level*0.18,0),w*0.70,0.10,accent,0.05)
   roof.mesh.radial_segments = 4
   roof.rotation.y = PI/4
  cylinder(model,Vector3(0,0.95,0),0.018,0.30,brass,0)
 else:
  for j in range(3):
   var h := 0.38+float((index+j*3)%7)*0.08
   var x := float(j-1)*0.26
   box(model,Vector3(x,h/2+0.08,0),Vector3(0.21,h,0.27),ivory if j!=1 else accent)
   box(model,Vector3(x,h+0.09,0),Vector3(0.23,0.045,0.29),brass)
   for k in range(int(h/0.12)):
    for col in [-1,1]: box(model,Vector3(x+col*0.05,0.14+k*0.12,0.142),Vector3(0.04,0.055,0.012),glass)
  if kind=="spire" or kind=="tower": cylinder(model,Vector3(0,1.02,0),0.025,0.40,brass,0)

func build_center() -> void:
 # Vector source imported at 4096 px, with mipmaps for stable oblique viewing.
 var artwork := PlaneMesh.new()
 artwork.size = Vector2(15.7,15.7)
 var material := StandardMaterial3D.new()
 material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
 material.albedo_texture = load("res://assets/centre-vectoriel.svg")
 material.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
 mesh(self,artwork,Vector3(0,0.335,0),material)
 for side in [-1,1]:
  for j in range(4):
   var card := box(self,Vector3(side*4.3,0.4+j*0.045,-2.3),Vector3(1.3,0.04,1.9),mat(Color("1c4c56") if side<0 else Color("bda06c"),0.2))
   card.rotation.y = side*0.15+j*0.025
  text3(self,"DESTIN" if side<0 else "MARCHÉ",Vector3(side*4.3,0.60,-2.3),23,Color("f4e7c7"))

func build_tokens() -> void:
 pawns = load("res://pawns.gd").new()
 add_child(pawns)
 pawns.setup(positions)
 token = pawns.pieces[0]
 pawns.crossed_tile.connect(func(index: int):
  steps_moved += 1
  selection.position = positions[index]+Vector3(0,0.15,0)
  detail.text = "Case %02d · %s" % [index+1,str(tiles[index].name)]
 )

func build_dice() -> void:
 dice_rig = load("res://premium_dice.gd").new()
 add_child(dice_rig)
 dice = dice_rig.dice

func label_at(parent: Control, value: String, pos: Vector2, size: int, color: Color) -> Label:
 var l := Label.new()
 l.text = value
 l.position = pos
 l.add_theme_font_size_override("font_size",size)
 l.add_theme_color_override("font_color",color)
 parent.add_child(l)
 header_labels.append(l)
 return l

func build_ui() -> void:
 var layer := CanvasLayer.new()
 add_child(layer)
 var ui := Control.new()
 legacy_ui = ui
 ui.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
 ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
 layer.add_child(ui)
 label_at(ui,"A / R",Vector2(42,28),26,GOLD)
 label_at(ui,"FORTUNE EMPIRE",Vector2(42,65),14,Color("eef0e8"))
 label_at(ui,"LE GRAND TOUR  /  ÉTUDE DE PLATEAU",Vector2(42,91),11,Color("91aaa9"))
 var top := Label.new()
 top.text = "COLLECTION 01     •     40 ESCALES     •     GODOT 4"
 top.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
 top.position = Vector2(-480,42)
 top.add_theme_font_size_override("font_size",12)
 top.add_theme_color_override("font_color",GOLD)
 collection_label = top
 ui.add_child(top)
 var panel := PanelContainer.new()
 footer_panel = panel
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
 var row := GridContainer.new()
 footer_grid = row
 row.columns = 2
 row.add_theme_constant_override("h_separation",24)
 row.add_theme_constant_override("v_separation",10)
 panel.add_child(row)
 var column := VBoxContainer.new()
 column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
 column.alignment = BoxContainer.ALIGNMENT_CENTER
 row.add_child(column)
 status = Label.new()
 status.text = "EXPLOREZ VOTRE EMPIRE"
 status.add_theme_color_override("font_color",GOLD)
 status.add_theme_font_size_override("font_size",22)
 status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
 column.add_child(status)
 detail = Label.new()
 detail.text = "Cliquez sur une ville pour découvrir son escale."
 detail.add_theme_font_size_override("font_size",17)
 detail.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
 column.add_child(detail)
 var actions := HBoxContainer.new()
 actions.size_flags_horizontal = Control.SIZE_EXPAND_FILL
 actions.add_theme_constant_override("separation",8)
 row.add_child(actions)
 for title in ["Vue cinéma","Vue du dessus","Détail","Lancer les dés"]:
  var button := Button.new()
  button.text = title
  button.custom_minimum_size = Vector2(100,48)
  button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
  button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
  var s := StyleBoxFlat.new()
  s.bg_color = Color("bda374") if title=="Lancer les dés" else Color("193b43")
  s.set_corner_radius_all(6)
  s.content_margin_left = 16
  s.content_margin_right = 16
  button.add_theme_stylebox_override("normal",s)
  button.add_theme_color_override("font_color",INK if title=="Lancer les dés" else Color("e9e1ce"))
  actions.add_child(button)
  footer_buttons.append(button)
  if title=="Vue cinéma": button.pressed.connect(func(): orbit = not orbit)
  elif title=="Vue du dessus": button.pressed.connect(func(): orbit = false; pitch = 1.48; yaw = 0; distance = 29; camera_target = Vector3.ZERO)
  elif title=="Détail": button.pressed.connect(focus_tile)
  else:
   roll_button = button
   button.pressed.connect(roll)
 var hint := Label.new()
 footer_hint = hint
 hint.text = "GLISSER POUR TOURNER   /   MOLETTE POUR ZOOMER   /   ESPACE : DÉS   /   R : VUE INITIALE"
 hint.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
 hint.position = Vector2(42,-145)
 hint.add_theme_font_size_override("font_size",11)
 hint.add_theme_color_override("font_color",Color("93aaa8"))
 ui.add_child(hint)
 tile_picker = OptionButton.new()
 tile_picker.position = Vector2(42,126)
 tile_picker.custom_minimum_size = Vector2(300,44)
 tile_picker.add_theme_font_size_override("font_size",17)
 tile_picker.get_popup().add_theme_font_size_override("font_size",19)
 tile_picker.add_item("Explorer les 40 cases",0)
 for i in range(40):
  tile_picker.add_item("%02d · %s" % [i+1,tiles[i].name],i+1)
 tile_picker.item_selected.connect(func(index: int):
  if index>0: select_tile(index-1)
 )
 ui.add_child(tile_picker)
 update_responsive_ui()

func update_camera() -> void:
 camera.position = Vector3(sin(yaw)*cos(pitch),sin(pitch),cos(yaw)*cos(pitch))*distance
 var view := get_viewport().get_visible_rect().size
 var aspect: float = view.x/maxf(1.0,view.y)
 var framing: float = maxf(1.0,0.92/aspect)
 camera.position = camera_target+camera.position*framing
 camera.look_at(camera_target+Vector3(0,0.15,0))

func _process(delta: float) -> void:
 time += delta
 if get_viewport().get_visible_rect().size != last_viewport_size:
  update_responsive_ui()
 if orbit and not dragging: yaw += delta*0.045
 if follow_pawn:
  camera_target = camera_target.lerp(token.position,1.0-exp(-delta*4.0))
 update_camera()
 update_city_labels()
 animate_world(delta)
 if selection: selection.position.y = 0.15+sin(time*2)*0.025

func _unhandled_input(event: InputEvent) -> void:
 if renderer_mode or moving: return
 if is_instance_valid(trading) and trading.is_open(): return
 if event is InputEventScreenDrag:
  orbit = false
  yaw -= event.relative.x*0.006
  pitch = clamp(pitch+event.relative.y*0.005,0.35,1.5)
 if event is InputEventScreenTouch and not event.pressed: pick(event.position)
 if event is InputEventMagnifyGesture: distance = clamp(distance/event.factor,15.0,45.0)
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
  if event.keycode == KEY_R: yaw = 0; pitch = 0.80; distance = 34; orbit = false; camera_target = Vector3.ZERO

func pick(screen: Vector2) -> void:
 var from := camera.project_ray_origin(screen)
 var query := PhysicsRayQueryParameters3D.create(from,from+camera.project_ray_normal(screen)*100)
 var hit := get_world_3d().direct_space_state.intersect_ray(query)
 if hit and hit.collider.has_meta("tile"):
  select_tile(int(hit.collider.get_meta("tile")))

func focus_tile() -> void:
 var index := selected_tile if selected_tile>=0 else 1
 select_tile(index)
 orbit = false
 camera_target = positions[index]
 distance = 8.5
 pitch = 0.95
 yaw = -float(index/10)*PI/2.0

func select_tile(i: int) -> void:
 selected_tile = i
 var t: Dictionary = tiles[i]
 selection.position = positions[i]+Vector3(0,0.15,0)
 status.text = str(t.name).to_upper()
 detail.text = "%s  •  %d €  •  Case %02d / 40" % [t.get("country","Grand Tour"), t.price, i+1] if t.kind=="city" else "Case %02d / 40  •  %s" % [i+1,str(t.name)]
 tile_picker.select(i+1)

func update_responsive_ui() -> void:
 last_viewport_size = get_viewport().get_visible_rect().size
 if not is_instance_valid(footer_panel): return
 var compact := last_viewport_size.x < 1100 or last_viewport_size.y < 700
 var short_screen := last_viewport_size.y < 600
 footer_grid.columns = 1 if compact else 2
 footer_panel.offset_left = 16 if compact else 32
 footer_panel.offset_right = -16 if compact else -32
 footer_panel.offset_top = -135 if short_screen else (-220 if compact else -140)
 for label in header_labels: label.visible = not short_screen
 collection_label.visible = not compact
 footer_hint.visible = not compact
 footer_hint.position.y = -165
 for i in range(footer_buttons.size()):
  footer_buttons[i].text = ["Cinéma","Dessus","Détail","Lancer"][i] if compact else ["Vue cinéma","Vue du dessus","Détail","Lancer les dés"][i]
  footer_buttons[i].custom_minimum_size.x = 60 if compact else 130
  footer_buttons[i].add_theme_font_size_override("font_size",14 if compact else 16)
  var button_style: StyleBoxFlat = footer_buttons[i].get_theme_stylebox("normal").duplicate()
  button_style.content_margin_left = 6 if compact else 16
  button_style.content_margin_right = 6 if compact else 16
  footer_buttons[i].add_theme_stylebox_override("normal",button_style)
 tile_picker.position = Vector2(20 if compact else 42,12 if short_screen else 126)
 tile_picker.custom_minimum_size.x = min(300,last_viewport_size.x-40)
 status.add_theme_font_size_override("font_size",20 if compact else 22)
 detail.add_theme_font_size_override("font_size",17)
 if turn_phase=="manage": roll_button.text = "Fin du tour" if compact else "Terminer le tour"
 if is_instance_valid(trading): trading.resize_ui()

func finish_turn() -> void:
 if moving or turn_phase!="manage": return
 pawns.active = (pawns.active+1)%8
 turn_phase = "roll"
 status.text = pawns.NAMES[pawns.active].to_upper()+" · À VOUS DE JOUER"
 detail.text = "Lancez les dés pour votre prochain voyage."
 update_responsive_ui()
 trading.refresh_bar()

func roll() -> void:
 if moving or (is_instance_valid(trading) and trading.is_open()): return
 if turn_phase=="manage":
  finish_turn()
  return
 moving = true
 turn_phase = "moving"
 roll_button.disabled = true
 var a := rng.randi_range(1,6)
 var b := rng.randi_range(1,6)
 var piece: int = pawns.active
 token = pawns.pieces[piece]
 saved_camera = {"target":camera_target,"distance":distance,"pitch":pitch,"yaw":yaw,"orbit":orbit}
 orbit = false
 follow_pawn = false
 # Camera transition is performed before the dice leave the table.
 travel_stage = "dice"
 steps_moved = 0
 dice_values = [0,0]
 dice_total = 0
 pitch = 0.94
 session.log_event("%s lance les dés : %d + %d." % [pawns.NAMES[piece],a,b])
 trading.refresh_bar()
 status.text = pawns.NAMES[piece].to_upper()+" · EN ROUTE"
 detail.text = "Lancer en cours"
 await direct_camera(Vector3(0,0.3,-3.6),13.0,0.94,0.32)
 var valid: bool = await dice_rig.roll_pair(a,b)
 if not valid:
  moving = false
  turn_phase = "roll"
  roll_button.disabled = false
  status.text = "Le lancer n’a pas abouti. Réessayez."
  return
 dice_values = dice_rig.top_values()
 dice_total = dice_values[0]+dice_values[1]
 detail.text = "%d + %d = %d cases" % [dice_values[0],dice_values[1],dice_total]
 await get_tree().create_timer(0.35).timeout
 travel_stage = "travel"
 follow_pawn = true
 create_tween().tween_property(self,"distance",15.0,0.4).set_trans(Tween.TRANS_SINE)
 await pawns.move_active(dice_total)
 token_index = pawns.indices[piece]
 pawns.active = piece
 follow_pawn = false
 travel_stage = ""
 await direct_camera(saved_camera.target,saved_camera.distance,saved_camera.pitch,0.35)
 yaw = saved_camera.yaw
 orbit = saved_camera.orbit
 turn_phase = "manage"
 session.log_event("%s arrive à %s." % [pawns.NAMES[piece],tiles[token_index].name])
 selection.position = positions[token_index]+Vector3(0,0.15,0)
 status.text = "%s · %s" % [pawns.NAMES[piece],str(tiles[token_index].name)]
 detail.text = "Arrivée case %02d · Achetez, négociez, puis terminez votre tour." % [token_index+1]
 var purchase_ready: bool = session.price(token_index)>0 and not session.owners.has(token_index)
 if purchase_ready: await get_tree().create_timer(0.4).timeout
 moving = false
 roll_button.disabled = false
 update_responsive_ui()
 trading.refresh_bar()
 if purchase_ready: trading.open("portfolio")


func build_city_labels() -> void:
 var layer := CanvasLayer.new()
 layer.layer = 2
 add_child(layer)
 name_overlay = Control.new()
 name_overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
 name_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
 layer.add_child(name_overlay)
 for i in range(40):
  var t: Dictionary = tiles[i]
  if t.kind != "city": continue
  var line := Line2D.new()
  line.width = 1.0
  line.default_color = Color(0.65,0.77,0.73,0.65)
  name_overlay.add_child(line)
  var panel := PanelContainer.new()
  panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
  var style := StyleBoxFlat.new()
  style.bg_color = Color("10252d")
  style.border_color = Color(t.color)
  style.border_width_left = 3
  style.set_corner_radius_all(4)
  style.content_margin_left = 9
  style.content_margin_right = 9
  style.content_margin_top = 5
  style.content_margin_bottom = 5
  panel.add_theme_stylebox_override("panel",style)
  var column := VBoxContainer.new()
  column.mouse_filter = Control.MOUSE_FILTER_IGNORE
  column.add_theme_constant_override("separation",0)
  panel.add_child(column)
  var name_label := Label.new()
  name_label.text = str(t.name)
  name_label.add_theme_font_size_override("font_size",15)
  name_label.add_theme_color_override("font_color",Color("f3f0e5"))
  column.add_child(name_label)
  var price := Label.new()
  price.text = "%02d   /   %d €" % [i+1,t.price]
  price.add_theme_font_size_override("font_size",11)
  price.add_theme_color_override("font_color",Color("b4c8bf"))
  column.add_child(price)
  name_overlay.add_child(panel)
  city_labels.append({"index":i,"panel":panel,"line":line})

func update_city_labels() -> void:
 if city_labels.is_empty(): return
 var viewport_size := get_viewport().get_visible_rect().size
 var compact := viewport_size.x<1100 or viewport_size.y<700
 compact = compact or camera_target.length()>1
 var safe := Rect2(Vector2(248,205),viewport_size-Vector2(270,370))
 var placed: Array[Rect2] = []
 var center := camera.unproject_position(Vector3(0,0.4,0))
 for entry in city_labels:
  var i: int = entry.index
  var panel: PanelContainer = entry.panel
  var line: Line2D = entry.line
  panel.visible = not compact or selected_tile==i
  line.visible = panel.visible
  if not panel.visible: continue
  var anchor := camera.unproject_position(positions[i]+Vector3(0,0.65,0))
  var outer := camera.unproject_position(positions[i]*1.22+Vector3(0,0.65,0))
  var outward := (outer-center).normalized()
  var tangent := Vector2(-outward.y,outward.x)
  var size := panel.get_combined_minimum_size()
  panel.size = size
  var desired := outer+outward*12-size/2
  var chosen := desired
  var found := false
  # Find a free rectangle around its projected case; labels never rotate or shrink.
  for band in range(10):
   if found: break
   for offset in [0,1,-1,2,-2,3,-3,4,-4]:
    var candidate := desired+outward*float(band)*19+tangent*float(offset)*24
    candidate.x = clamp(candidate.x,safe.position.x,max(safe.position.x,safe.end.x-size.x))
    candidate.y = clamp(candidate.y,safe.position.y,max(safe.position.y,safe.end.y-size.y))
    var rect := Rect2(candidate,size).grow(4)
    var free := true
    for other in placed:
     if rect.intersects(other): free = false; break
    if free:
     chosen = candidate
     found = true
     break
  if not found:
   var best_score := INF
   for y in range(int(safe.position.y),int(safe.end.y-size.y)+1,12):
    for x in range(int(safe.position.x),int(safe.end.x-size.x)+1,16):
     var candidate := Vector2(x,y)
     var score := candidate.distance_squared_to(desired)
     if score>=best_score: continue
     var rect := Rect2(candidate,size).grow(4)
     var free := true
     for other in placed:
      if rect.intersects(other): free = false; break
     if free:
      best_score = score
      chosen = candidate
  panel.position = chosen
  placed.append(Rect2(chosen,size).grow(4))
  var end := Vector2(clamp(anchor.x,chosen.x,chosen.x+size.x),clamp(anchor.y,chosen.y,chosen.y+size.y))
  line.points = PackedVector2Array([anchor,end])


func tree_at(parent: Node3D, base: Vector3, scale_factor := 1.0) -> void:
 var group := Node3D.new()
 parent.add_child(group)
 group.position = base
 group.scale = Vector3.ONE*scale_factor
 cylinder(group,Vector3(0,0.20,0),0.035,0.40,mat(Color("755941")))
 for i in range(3):
  var sphere := SphereMesh.new()
  sphere.radius = 0.15+float(i)*0.015
  sphere.height = sphere.radius*2
  mesh(group,sphere,Vector3(sin(i*2.1)*0.09,0.45+i*0.07,cos(i*2.1)*0.07),mat([Color("296c58"),Color("408467"),Color("66a476")][i],0.0,0.9))

func lamp_at(pos: Vector3) -> void:
 var dark := mat(Color("183339"),0.65)
 cylinder(self,pos+Vector3(0,0.38,0),0.018,0.76,dark)
 cylinder(self,pos+Vector3(0,0.04,0),0.07,0.08,dark)
 var globe := SphereMesh.new()
 globe.radius = 0.065
 globe.height = 0.13
 mesh(self,globe,pos+Vector3(0,0.8,0),mat(Color("ffd99a"),0.2,0.4,0.65))
 cylinder(self,pos+Vector3(0,0.88,0),0.085,0.035,dark,0.02)

func build_living_world() -> void:
 var bronze := mat(GOLD,0.75,0.3)
 var stone := mat(Color("57736e"),0.05,0.85)
 # Four miniature garden terraces inside the board's corners.
 for x in [-6.5,6.5]:
  for z in [-6.5,6.5]:
   var garden := Node3D.new()
   add_child(garden)
   garden.position = Vector3(x,0.36,z)
   box(garden,Vector3(0,0.05,0),Vector3(1.65,0.14,1.65),bronze)
   box(garden,Vector3(0,0.13,0),Vector3(1.53,0.08,1.53),mat(Color("284f46"),0.0,1))
   for k in range(4):
    var a := k*PI/2+PI/4
    tree_at(garden,Vector3(sin(a)*0.7,0.17,cos(a)*0.7),0.9)
   cylinder(garden,Vector3(0,0.22,0),0.36,0.13,stone)
   cylinder(garden,Vector3(0,0.30,0),0.29,0.02,mat(Color("399b9b"),0.35,0.15,0.12))
   cylinder(garden,Vector3(0,0.46,0),0.055,0.32,bronze)
   cylinder(garden,Vector3(0,0.62,0),0.18,0.035,bronze)
   # Fountain jets, softly translucent in spirit, with animated droplets.
   for k in range(3):
    var drop := SphereMesh.new()
    drop.radius = 0.023
    drop.height = 0.046
    var node := mesh(garden,drop,Vector3(0,0.75+k*0.12,0),mat(Color("9be1db"),0.25,0.2,0.25))
    node.set_meta("phase",k*1.8+x)
    motes.append(node)
 # Fine rail lines around the central inset and moving miniature trams.
 for side in range(4):
  for offset in [-0.045,0.045]:
   var rail := box(self,Vector3(0,0.36,7.50+offset),Vector3(14.9,0.018,0.018),bronze)
   var parent := Node3D.new()
   add_child(parent)
   remove_child(rail)
   parent.add_child(rail)
   parent.rotation.y = side*PI/2
  for k in range(5):
   var a := -5.2+k*2.6
   var v := Vector3(a,0.38,7.2).rotated(Vector3.UP,side*PI/2)
   lamp_at(v)
 for i in range(3):
  var tram := Node3D.new()
  add_child(tram)
  var color: Color = [Color("ba7951"),Color("539c95"),Color("aebda4")][i]
  box(tram,Vector3(0,0.12,0),Vector3(0.25,0.22,0.60),mat(color,0.5))
  box(tram,Vector3(0,0.27,0),Vector3(0.27,0.07,0.64),bronze)
  for z in [-0.18,0.0,0.18]:
   for x in [-0.132,0.132]:
    box(tram,Vector3(x,0.17,z),Vector3(0.008,0.09,0.12),mat(Color("ffe1a7"),0.0,0.5,0.45))
  traffic.append(tram)
 # A rotating armillary globe, the living heart of the Grand Tour.
 cylinder(self,Vector3(0,0.43,0),1.0,0.18,bronze)
 cylinder(self,Vector3(0,0.57,0),0.86,0.12,stone)
 animated_globe = Node3D.new()
 animated_globe.position = Vector3(0,1.8,0)
 add_child(animated_globe)
 var globe_mesh := SphereMesh.new()
 globe_mesh.radius = 0.92
 globe_mesh.height = 1.84
 mesh(animated_globe,globe_mesh,Vector3.ZERO,mat(Color("164d61"),0.45,0.25))
 # Stylized raised continental patches on a spherical surface.
 for patch in range(55):
  var lat := sin(patch*2.19)*1.0
  var lon := patch*2.4
  if sin(lon*2+lat*3)+cos(lat*7-lon)<0.2: continue
  var normal := Vector3(cos(lat)*sin(lon),sin(lat),cos(lat)*cos(lon))
  var piece := SphereMesh.new()
  piece.radius = 0.12+float(patch%3)*0.035
  piece.height = piece.radius*1.1
  var land := mesh(animated_globe,piece,normal*0.91,mat(Color("7da68b"),0.35,0.65))
  land.look_at(animated_globe.global_position,Vector3.UP)
 for i in range(3):
  var ring := TorusMesh.new()
  ring.inner_radius = 1.08+i*0.08
  ring.outer_radius = ring.inner_radius+0.022
  var node := mesh(self,ring,Vector3(0,1.8,0),bronze)
  node.rotation = Vector3(0.3+i*0.65,0,i*0.75)
 cylinder(self,Vector3(0,0.93,0),0.08,0.7,bronze)
 # Quiet animated airship on an orbit above the central map.
 airship = Node3D.new()
 add_child(airship)
 var balloon := SphereMesh.new()
 balloon.radius = 0.25
 balloon.height = 0.5
 mesh(airship,balloon,Vector3.ZERO,mat(Color("d4c092"),0.25,0.65)).scale = Vector3(1,1,2.7)
 box(airship,Vector3(0,-0.29,0),Vector3(0.16,0.12,0.38),bronze)
 box(airship,Vector3(0,0.12,0.51),Vector3(0.025,0.32,0.28),mat(Color("57958b")))
 # Tiny gardens and pennants give every city its own inhabited frontage.
 for i in range(40):
  if tiles[i].kind != "city": continue
  var ornament := Node3D.new()
  add_child(ornament)
  ornament.position = positions[i]
  ornament.rotation.y = -float(i/10)*PI/2
  tree_at(ornament,Vector3(-0.58,0.38,-0.36),0.62)
  cylinder(ornament,Vector3(0.55,0.71,-0.45),0.012,0.65,bronze)
  var flag := box(ornament,Vector3(0.65,0.95,-0.45),Vector3(0.22,0.13,0.018),mat(Color(tiles[i].color),0.15))
  flag.set_meta("phase",i*0.9)
  sails.append(flag)
  # Lit shop windows at the edge of the miniature plinth.
  for j in range(3):
   box(ornament,Vector3(-0.15+j*0.15,0.48,-0.43),Vector3(0.065,0.09,0.025),mat(Color("efce8e"),0.1,0.5,0.28))

func animate_world(_delta: float) -> void:
 if not is_instance_valid(animated_globe): return
 animated_globe.rotation.y = time*0.12
 airship.position = Vector3(sin(time*0.14)*3.7,2.7+sin(time*0.7)*0.12,cos(time*0.14)*3.7)
 airship.rotation.y = time*0.14+PI/2
 for i in range(traffic.size()):
  var progress := fmod(time*0.50+i*20.0,60.0)
  var side := int(progress/15)
  var offset := fmod(progress,15.0)
  traffic[i].position = Vector3(-7.5+offset,0.40,7.5).rotated(Vector3.UP,side*PI/2)
  traffic[i].rotation.y = side*PI/2+PI/2
 for drop in motes:
  var phase: float = drop.get_meta("phase")
  drop.position.y = 0.68+fmod(time*0.6+phase,0.42)
 for flag in sails:
  var phase: float = flag.get_meta("phase")
  flag.rotation.y = sin(time*2+phase)*0.18


func refresh_ownership() -> void:
 for tile in session.owners:
  var owner: int = session.owners[tile]
  var marker: MeshInstance3D
  if owner_markers.has(tile): marker = owner_markers[tile]
  else:
   var offset := Vector3(0,0.374,0.79).rotated(Vector3.UP,-float(int(tile)/10)*PI/2)
   marker = box(self,positions[tile]+offset,Vector3(1.35,0.018,0.035),mat(pawns.COLORS[owner],0.2))
   marker.rotation.y = -float(int(tile)/10)*PI/2
   owner_markers[tile] = marker
  marker.material_override.albedo_color = pawns.COLORS[owner]


func direct_camera(target: Vector3, next_distance: float, next_pitch: float, duration: float) -> void:
 var transition := create_tween().set_parallel(true)
 transition.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
 transition.tween_property(self,"camera_target",target,duration)
 transition.tween_property(self,"distance",next_distance,duration)
 transition.tween_property(self,"pitch",next_pitch,duration)
 await transition.finished
