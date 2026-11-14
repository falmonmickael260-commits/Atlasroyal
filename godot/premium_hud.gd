extends Control
## One visual system for the table, navigation and turn actions.
var host: Node3D
var state: RefCounted
var menus: CanvasLayer
var top_grid: GridContainer
var top: PanelContainer
var bottom: PanelContainer
var rail: PanelContainer
var identity: Label
var balance: Label
var movement_progress: ProgressBar
var phase: Label
var instruction: Label
var action: Button
var camera_bar: HBoxContainer
var player_rows: Array[PanelContainer] = []
var player_texts: Array[Label] = []
var player_names: Array[Label] = []
var tab_buttons: Array[Button] = []
var brand: Label
var caption: Label
var nav_grid: GridContainer
var bottom_grid: GridContainer
var steps: Label
var serif: Font = preload("res://assets/ui/EmpireSerif.ttf")
const GOLD = Color("d6b982")
const PAPER = Color("f1eadb")
const MUTED = Color("93aba6")

func panel(parent: Node, bg := Color("0c2329"), padding := 18) -> PanelContainer:
 var p := PanelContainer.new()
 var s := StyleBoxFlat.new()
 s.bg_color = bg
 s.border_color = Color("3a514d")
 s.set_border_width_all(1)
 s.set_corner_radius_all(12)
 s.shadow_color = Color(0,0,0,0.28)
 s.shadow_size = 12
 s.shadow_offset = Vector2(0,5)
 s.set_content_margin_all(padding)
 p.add_theme_stylebox_override("panel",s)
 parent.add_child(p)
 return p

func label(parent: Node, value: String, size: int, color := PAPER, display := false) -> Label:
 var l := Label.new()
 l.text = value
 l.add_theme_font_size_override("font_size",size)
 l.add_theme_color_override("font_color",color)
 if display: l.add_theme_font_override("font",serif)
 l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
 parent.add_child(l)
 return l

func setup(scene: Node3D, session: RefCounted, manager: CanvasLayer) -> void:
 host = scene
 state = session
 menus = manager
 mouse_filter = Control.MOUSE_FILTER_IGNORE
 set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
 top = panel(self,Color("091e25"),18)
 var top_col := VBoxContainer.new()
 top_grid = GridContainer.new()
 top_grid.columns = 2
 top_grid.add_theme_constant_override("h_separation",32)
 top.add_child(top_grid)
 top_col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
 top_grid.add_child(top_col)
 brand = label(top_col,"FORTUNE EMPIRE",28,GOLD,true)
 caption = label(top_col,"LE MONDE VOUS APPARTIENT",10,MUTED)
 nav_grid = GridContainer.new()
 nav_grid.columns = 4
 nav_grid.add_theme_constant_override("h_separation",8)
 nav_grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
 top_grid.add_child(nav_grid)
 for item in [["Plateau","table"],["Propriétés","portfolio"],["Échanges","trades"],["Joueurs","players"]]:
  var key: String = item[1]
  var b: Button = menus.button(nav_grid,item[0],func():
   if key=="table":
    menus.close(); host.camera_target = Vector3.ZERO; host.distance = 34; host.pitch = 0.80; host.yaw = 0
   else: menus.open(key)
  )
  b.toggle_mode = true
  b.set_meta("page",key)
  b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
  tab_buttons.append(b)
 rail = panel(self,Color("0b2229"),14)
 var column := VBoxContainer.new()
 column.add_theme_constant_override("separation",7)
 rail.add_child(column)
 label(column,"LES INVESTISSEURS",11,GOLD)
 for i in range(8):
  var card := panel(column,Color("102b32"),10)
  var player_index: int = i
  card.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
  card.tooltip_text = "Consulter le patrimoine de "+state.names[i]
  card.gui_input.connect(func(event: InputEvent):
   if event is InputEventMouseButton and event.pressed and event.button_index==MOUSE_BUTTON_LEFT:
    menus.open_player(player_index)
  )
  var row := HBoxContainer.new()
  row.add_theme_constant_override("separation",10)
  card.add_child(row)
  var number := label(row,"%02d" % (i+1),18,host.pawns.COLORS[i],true)
  number.custom_minimum_size.x = 26
  var words := VBoxContainer.new()
  words.size_flags_horizontal = Control.SIZE_EXPAND_FILL
  row.add_child(words)
  player_names.append(label(words,state.names[i],14))
  player_texts.append(label(words,"",12,MUTED))
  player_rows.append(card)
 camera_bar = HBoxContainer.new()
 camera_bar.add_theme_constant_override("separation",8)
 add_child(camera_bar)
 menus.button(camera_bar,"Vue générale",func():
  host.camera_target = Vector3.ZERO; host.distance = 34; host.pitch = 0.80; host.yaw = 0
 )
 menus.button(camera_bar,"Détail",host.focus_tile)
 menus.button(camera_bar,"Cinéma",func(): host.orbit = not host.orbit)
 bottom = panel(self,Color("0b2229"),20)
 bottom_grid = GridContainer.new()
 bottom_grid.columns = 3
 bottom_grid.add_theme_constant_override("h_separation",28)
 bottom_grid.add_theme_constant_override("v_separation",12)
 bottom.add_child(bottom_grid)
 var account := VBoxContainer.new()
 account.size_flags_horizontal = Control.SIZE_EXPAND_FILL
 bottom_grid.add_child(account)
 identity = label(account,"",21,PAPER,true)
 balance = label(account,"",16,GOLD)
 var progression := VBoxContainer.new()
 progression.size_flags_horizontal = Control.SIZE_EXPAND_FILL
 bottom_grid.add_child(progression)
 steps = label(progression,"01  LANCER     /     02  GÉRER     /     03  TRANSMETTRE",10,GOLD)
 phase = label(progression,"",18)
 instruction = label(progression,"",13,MUTED)
 movement_progress = ProgressBar.new()
 movement_progress.show_percentage = false
 movement_progress.max_value = 1.0
 movement_progress.custom_minimum_size.y = 4
 for kind in ["background","fill"]:
  var track := StyleBoxFlat.new()
  track.bg_color = GOLD if kind=="fill" else Color("243c40")
  track.set_corner_radius_all(2)
  movement_progress.add_theme_stylebox_override(kind,track)
 progression.add_child(movement_progress)
 action = menus.button(bottom_grid,"Lancer les dés",host.roll,true)
 action.custom_minimum_size = Vector2(210,56)
 action.size_flags_vertical = Control.SIZE_SHRINK_CENTER
 resized.connect(resize_hud)
 resize_hud()

func resize_hud() -> void:
 if not is_instance_valid(top): return
 var view := get_viewport_rect().size
 var compact := view.x<1100
 var short := view.y<620
 top.position = Vector2(18,18)
 top.size = Vector2(view.x-36,0)
 brand.add_theme_font_size_override("font_size",23 if compact else 28)
 caption.visible = not short
 top_grid.columns = 1 if compact else 2
 nav_grid.columns = 4
 for b in tab_buttons:
  b.add_theme_font_size_override("font_size",12 if compact else 15)
  b.custom_minimum_size.y = 40
  var s: StyleBoxFlat = b.get_theme_stylebox("normal").duplicate()
  s.set_content_margin_all(6 if compact else 10)
  b.add_theme_stylebox_override("normal",s)
 rail.visible = not compact and not menus.is_open()
 rail.position = Vector2(18,180)
 rail.size = Vector2(216,0)
 for i in range(player_rows.size()):
  var row_style: StyleBoxFlat = player_rows[i].get_theme_stylebox("panel").duplicate()
  row_style.set_content_margin_all(6 if view.y<900 else 10)
  player_rows[i].add_theme_stylebox_override("panel",row_style)
  player_names[i].add_theme_font_size_override("font_size",12 if view.y<900 else 14)
  player_texts[i].add_theme_font_size_override("font_size",11 if view.y<900 else 12)
 camera_bar.visible = not compact
 camera_bar.position = Vector2(view.x-370,124)
 bottom.position = Vector2(18,view.y-(210 if compact else 138))
 bottom.size = Vector2(view.x-36,192 if compact else 120)
 bottom_grid.columns = 1 if compact else 3
 steps.visible = not compact
 instruction.visible = not compact
 action.custom_minimum_size.x = 0 if compact else 210
 action.size_flags_horizontal = Control.SIZE_EXPAND_FILL
 balance.add_theme_font_size_override("font_size",15 if compact else 16)
 if compact:
  top.size.x = view.x-36
  camera_bar.visible = false

func _process(_delta: float) -> void:
 if not is_instance_valid(host.pawns): return
 var view := get_viewport_rect().size
 var compact := view.x<1100
 top.size = Vector2(view.x-36,0)
 rail.size = Vector2(216,0)
 var footer_height := maxf(192 if compact else 120,bottom.get_combined_minimum_size().y)
 bottom.size = Vector2(view.x-36,footer_height)
 bottom.position = Vector2(18,view.y-footer_height-18)
 var i: int = host.pawns.active
 caption.text = "PARTIE D’ESSAI LOCALE  /  8 INVESTISSEURS" if state.demo else "LE MONDE VOUS APPARTIENT"
 identity.text = state.names[i]
 balance.text = "%d €   ·   %d propriétés" % [state.cash[i],state.portfolio(i).size()]
 phase.text = {"roll":"Votre prochain voyage commence ici.","moving":"Votre pièce est en route…","manage":"À vous de développer votre empire."}.get(host.turn_phase,"")
 instruction.text = "Achetez ou négociez, puis terminez votre tour." if host.turn_phase=="manage" else "Lancez les dés et partez à la conquête du plateau."
 if host.moving:
  phase.text = "Les dés sont lancés…" if host.travel_stage=="dice" else "%d + %d = %d cases" % [host.dice_values[0],host.dice_values[1],host.dice_total]
  instruction.text = "Regardez les deux faces supérieures." if host.travel_stage=="dice" else "Déplacement : %d / %d cases" % [host.steps_moved,host.dice_total]
 action.text = "Terminer mon tour" if host.turn_phase=="manage" else ("Déplacement…" if host.moving else "Lancer les dés")
 movement_progress.visible = host.moving and host.travel_stage=="travel" and not compact
 movement_progress.value = float(host.steps_moved)/maxi(1,host.dice_total)
 action.disabled = host.moving
 for j in range(8):
  player_texts[j].text = "%d €   ·   %d biens" % [state.cash[j],state.portfolio(j).size()]
  player_names[j].modulate = GOLD if i==j else PAPER
  var s: StyleBoxFlat = player_rows[j].get_theme_stylebox("panel").duplicate()
  var target: Color = host.pawns.COLORS[j] if i==j else Color("233d43")
  if s.border_color!=target:
   s.border_color = target
   s.bg_color = Color("1c373c") if i==j else Color("102b32")
   player_rows[j].add_theme_stylebox_override("panel",s)
 rail.visible = get_viewport_rect().size.x>=1100 and not menus.is_open()
 for camera_button in camera_bar.get_children(): camera_button.disabled = host.moving
 for b in tab_buttons:
  b.disabled = host.moving
  var active_page: String = menus.page if menus.is_open() else "table"
  if active_page in ["draft","review"]: active_page = "trades"
  b.set_pressed_no_signal(b.get_meta("page")==active_page)
