extends CanvasLayer
## Responsive local-table UI. No simulated online messages or hidden acceptance.
var host: Node3D
var state: RefCounted
var bar: PanelContainer
var turn_label: Label
var wallet: Label
var shade: ColorRect
var window: PanelContainer
var content: VBoxContainer
var footer_actions: VBoxContainer
var alert: Label
var header: Label
var page := "portfolio"
var viewer := 0
var partner := 1
var selected_give: Array[int] = []
var selected_receive: Array[int] = []
var give_cash := 0
var receive_cash := 0
var recipient_picker: OptionButton
var portrait_columns: GridContainer
var nav: Array[Button] = []
var demo_button: Button
const GOLD = Color("d9bd83")
const WHITE = Color("eee9dc")

func style(bg: Color, border := Color("344f53"), padding := 18) -> StyleBoxFlat:
 var s := StyleBoxFlat.new()
 s.bg_color = bg
 s.border_color = border
 s.set_border_width_all(1)
 s.set_corner_radius_all(10)
 s.content_margin_left = padding
 s.content_margin_right = padding
 s.content_margin_top = padding
 s.content_margin_bottom = padding
 return s

func text(parent: Node, value: String, size := 17, color := WHITE) -> Label:
 var l := Label.new()
 l.text = value
 l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
 l.add_theme_font_size_override("font_size",size)
 l.add_theme_color_override("font_color",color)
 parent.add_child(l)
 return l

func button(parent: Node, value: String, action: Callable, primary := false) -> Button:
 var b := Button.new()
 b.text = value
 b.custom_minimum_size.y = 44
 b.add_theme_font_size_override("font_size",15)
 b.add_theme_color_override("font_color",Color("10252d") if primary else WHITE)
 b.add_theme_stylebox_override("normal",style(Color("c9ad78") if primary else Color("1c3c45"),Color("607166"),10))
 b.add_theme_stylebox_override("hover",style(Color("dec58e") if primary else Color("2c535d"),GOLD,10))
 b.add_theme_stylebox_override("focus",style(Color(0,0,0,0),GOLD,10))
 b.pressed.connect(action)
 parent.add_child(b)
 return b

func setup(scene: Node3D, session: RefCounted) -> void:
 layer = 10
 host = scene
 state = session
 state.changed.connect(refresh_bar)
 var root := Control.new()
 root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
 root.mouse_filter = Control.MOUSE_FILTER_IGNORE
 add_child(root)
 bar = PanelContainer.new()
 bar.add_theme_stylebox_override("panel",style(Color("0d232b"),Color("3c5859"),12))
 root.add_child(bar)
 var row := VBoxContainer.new()
 bar.add_child(row)
 turn_label = text(row,"",17,GOLD)
 wallet = text(row,"",14)
 var links := HBoxContainer.new()
 row.add_child(links)
 for entry in [["Patrimoine","portfolio"],["Échanges","trades"],["Journal","journal"]]:
  var key: String = entry[1]
  nav.append(button(links,entry[0],func(): open(key)))
 shade = ColorRect.new()
 shade.color = Color(0.015,0.035,0.05,0.90)
 shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
 shade.mouse_filter = Control.MOUSE_FILTER_STOP
 root.add_child(shade)
 window = PanelContainer.new()
 window.add_theme_stylebox_override("panel",style(Color("0c232b"),Color("796c4d"),22))
 shade.add_child(window)
 var layout := VBoxContainer.new()
 layout.add_theme_constant_override("separation",14)
 window.add_child(layout)
 var head := HBoxContainer.new()
 layout.add_child(head)
 header = text(head,"",26,GOLD)
 header.size_flags_horizontal = Control.SIZE_EXPAND_FILL
 button(head,"Fermer",close)
 var note := text(layout,"TABLE LOCALE · Passez l’appareil au destinataire pour examiner une offre.",13,Color("92aca9"))
 note.name = "LocalNote"
 var tabs := HBoxContainer.new()
 layout.add_child(tabs)
 for entry in [["Mes biens","portfolio"],["Échanges","trades"],["Historique","journal"]]:
  var key: String = entry[1]
  button(tabs,entry[0],func(): show_page(key))
 alert = text(layout,"",15,Color("eab78e"))
 var scroll := ScrollContainer.new()
 scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
 scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
 layout.add_child(scroll)
 content = VBoxContainer.new()
 content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
 content.add_theme_constant_override("separation",14)
 scroll.add_child(content)
 footer_actions = VBoxContainer.new()
 footer_actions.add_theme_constant_override("separation",10)
 layout.add_child(footer_actions)
 shade.visible = false
 root.resized.connect(resize_ui)
 resize_ui()
 refresh_bar()

func resize_ui() -> void:
 if not is_instance_valid(bar): return
 var size := get_viewport().get_visible_rect().size
 var small := size.x<1000
 bar.position = Vector2(size.x-350 if not small else 16,85 if not small else 177)
 bar.size = Vector2(322 if not small else size.x-32,0)
 var w := minf(1120,size.x-24)
 var h := minf(820,size.y-24)
 window.position = (size-Vector2(w,h))/2
 window.size = Vector2(w,h)
 if is_instance_valid(portrait_columns): portrait_columns.columns = 1 if w<740 else 2

func refresh_bar() -> void:
 if not is_instance_valid(turn_label): return
 var actor: int = host.pawns.active
 for link in nav: link.disabled = host.moving
 turn_label.text = "%s · %s" % [state.names[actor],{"manage":"Gestion du tour","moving":"Déplacement en cours","roll":"À vous de jouer"}.get(host.turn_phase,"À vous de jouer")]
 wallet.text = "%d €  /  %d propriétés%s" % [state.cash[actor],state.portfolio(actor).size(),"  ·  ESSAI" if state.demo else ""]

func open(target: String) -> void:
 if host.moving: return
 viewer = host.pawns.active
 host.orbit = false
 shade.visible = true
 show_page(target)

func close() -> void:
 shade.visible = false

func is_open() -> bool: return shade.visible

func clear_content() -> void:
 for child in content.get_children():
  content.remove_child(child)
  child.queue_free()
 for child in footer_actions.get_children():
  footer_actions.remove_child(child)
  child.queue_free()
 summary = null
 portrait_columns = null
 alert.text = ""

func show_page(target: String) -> void:
 page = target
 clear_content()
 header.text = {"portfolio":"VOTRE PATRIMOINE","trades":"LE COMPTOIR DES ÉCHANGES","journal":"JOURNAL DE LA TABLE"}.get(page,"ÉCHANGE")
 if page=="players": players_page()
 elif page=="portfolio": portfolio_page()
 elif page=="trades": offers_page()
 elif page=="draft": draft_page()
 elif page=="journal":
  if state.journal.is_empty(): text(content,"Votre histoire commence au prochain lancer.")
  for event in state.journal: text(content,"•  "+event,16)
 resize_ui()

func portfolio_page() -> void:
 button(content,"Voir les huit joueurs",func(): show_page("players"))
 text(content,state.names[viewer],24,GOLD)
 text(content,"Trésorerie disponible : %d €" % state.cash[viewer],20)
 var owned: Array = state.portfolio(viewer)
 if owned.is_empty(): text(content,"Aucune propriété pour l’instant. Achetez une case libre à l’arrivée de votre pion.")
 for tile in owned: property_card(content,tile,false,[],false)
 if host.turn_phase=="manage" and viewer==host.pawns.active:
  var tile: int = host.pawns.indices[viewer]
  if state.price(tile)>0 and not state.owners.has(tile):
   text(content,"VOTRE ESCALE · "+str(state.tiles[tile].name).to_upper(),20,GOLD)
   var buy := button(content,"Acheter pour %d €" % state.price(tile),func():
    var error: String = state.buy(viewer,tile)
    if error.is_empty(): show_page("portfolio")
    else: alert.text = error
   ,true)
   buy.disabled = state.cash[viewer]<state.price(tile)
 if state.owners.is_empty() and state.offers.is_empty():
  text(content,"Envie d’essayer les échanges immédiatement ? La partie d’essai distribue deux villes à chacun des huit joueurs.",15,Color("9bb2ae"))
  demo_button = button(content,"Démarrer une partie d’essai locale",func():
   state.seed_demo()
   show_page("portfolio")
  )

func property_card(parent: Node, tile: int, selectable: bool, selection: Array, incoming: bool) -> void:
 var panel := PanelContainer.new()
 panel.add_theme_stylebox_override("panel",style(Color("17343c"),Color(state.tiles[tile].color),12))
 parent.add_child(panel)
 var row := HBoxContainer.new()
 panel.add_child(row)
 if selectable:
  var check := CheckBox.new()
  check.button_pressed = selection.has(tile)
  check.custom_minimum_size = Vector2(40,44)
  check.toggled.connect(func(enabled: bool):
   if enabled and not selection.has(tile): selection.append(tile)
   elif not enabled: selection.erase(tile)
   update_summary()
  )
  row.add_child(check)
 var col := VBoxContainer.new()
 col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
 row.add_child(col)
 text(col,str(state.tiles[tile].name),19)
 text(col,"%s · valeur %d €" % [state.tiles[tile].get("country","Escale spéciale"),state.price(tile)],13,Color("a4bbb4"))
 if incoming: text(col,"À RECEVOIR",12,GOLD)

func offers_page() -> void:
 viewer = host.pawns.active
 button(content,"+ Composer un échange",func():
  selected_give.clear(); selected_receive.clear(); give_cash = 0; receive_cash = 0
  partner = (viewer+1)%8
  show_page("draft")
 ,true)
 if state.offers.is_empty(): text(content,"Aucune offre. Choisissez un partenaire, proposez des propriétés et ajustez la somme échangée.")
 for offer in state.offers:
  var box := VBoxContainer.new()
  content.add_child(box)
  text(box,"#%d   %s → %s" % [offer.id,state.names[offer.from],state.names[offer.to]],19,GOLD)
  text(box,{"pending":"En attente de réponse","accepted":"Échange conclu","declined":"Offre refusée","cancelled":"Offre retirée","expired":"Offre expirée"}.get(offer.status,offer.status),14)
  button(box,"Voir le récapitulatif",func(): review_offer(offer.id,viewer))

var summary: Label
func draft_page() -> void:
 header.text = "COMPOSER UN ÉCHANGE"
 text(content,"Négocier avec",16,Color("a9bdb6"))
 recipient_picker = OptionButton.new()
 recipient_picker.custom_minimum_size.y = 46
 recipient_picker.add_theme_font_size_override("font_size",18)
 for i in range(8):
  if i==viewer: continue
  recipient_picker.add_item(state.names[i],i)
  if i==partner: recipient_picker.select(recipient_picker.item_count-1)
 recipient_picker.item_selected.connect(func(index: int):
  partner = recipient_picker.get_item_id(index)
  selected_receive.clear()
  receive_cash = 0
  show_page("draft")
 )
 content.add_child(recipient_picker)
 portrait_columns = GridContainer.new()
 portrait_columns.columns = 2
 portrait_columns.add_theme_constant_override("h_separation",22)
 portrait_columns.add_theme_constant_override("v_separation",18)
 content.add_child(portrait_columns)
 for incoming in [false,true]:
  var who := partner if incoming else viewer
  var col := VBoxContainer.new()
  col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
  col.add_theme_constant_override("separation",10)
  portrait_columns.add_child(col)
  text(col,"VOUS RECEVEZ" if incoming else "VOUS DONNEZ",20,GOLD)
  text(col,"%s · %d € disponibles" % [state.names[who],state.cash[who]],15)
  var owned: Array = state.portfolio(who)
  if owned.is_empty(): text(col,"Aucune propriété disponible.",16,Color("9db0ad"))
  for tile in owned: property_card(col,tile,true,selected_receive if incoming else selected_give,incoming)
  text(col,"Ajouter une somme (€)",15)
  var amount := SpinBox.new()
  amount.min_value = 0
  amount.max_value = state.cash[who]
  amount.step = 1
  amount.value = receive_cash if incoming else give_cash
  amount.custom_minimum_size.y = 46
  amount.get_line_edit().add_theme_font_size_override("font_size",18)
  amount.value_changed.connect(func(value: float):
   if incoming: receive_cash = int(value)
   else: give_cash = int(value)
   update_summary()
  )
  col.add_child(amount)
 summary = text(footer_actions,"",16)
 update_summary()
 button(footer_actions,"Soumettre la proposition",submit_offer,true)
 text(footer_actions,"Transfert uniquement après acceptation et vérification des disponibilités.",13,Color("97afaa"))

func update_summary() -> void:
 if is_instance_valid(summary):
  summary.text = "Votre offre : %d bien(s) + %d €   ↔   %d bien(s) + %d €\nSolde après accord : %d € pour vous / %d € pour %s" % [selected_give.size(),give_cash,selected_receive.size(),receive_cash,state.cash[viewer]-give_cash+receive_cash,state.cash[partner]-receive_cash+give_cash,state.names[partner]]

func submit_offer() -> void:
 var result: Dictionary = state.propose(viewer,partner,selected_give,selected_receive,give_cash,receive_cash)
 if result.has("error"): alert.text = result.error; return
 review_offer(result.id,viewer)

func describe_side(parent: Node, owner: int, assets: Array, amount: int) -> void:
 text(parent,state.names[owner]+" donne",20,GOLD)
 for tile in assets: property_card(parent,tile,false,[],false)
 text(parent,"%d €" % amount,22)

func review_offer(id: int, actor: int) -> void:
 clear_content()
 page = "review"
 var offer: Dictionary = state.find_offer(id)
 header.text = "OFFRE #%d · RÉCAPITULATIF" % id
 portrait_columns = GridContainer.new()
 portrait_columns.columns = 2
 portrait_columns.add_theme_constant_override("h_separation",22)
 portrait_columns.add_theme_constant_override("v_separation",14)
 content.add_child(portrait_columns)
 for from_side in [true,false]:
  var col := VBoxContainer.new()
  col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
  portrait_columns.add_child(col)
  describe_side(col,offer.from if from_side else offer.to,offer.give if from_side else offer.receive,offer.payment if from_side else offer.requested)
 text(content,"Lecture pour : "+state.names[actor],18)
 if offer.status=="pending":
  if actor==offer.to:
   button(content,"Accepter cet échange",func():
    var error: String = state.resolve(id,actor,"accept")
    if error.is_empty(): review_offer(id,actor)
    else: review_offer(id,actor); alert.text = error
   ,true)
   button(content,"Refuser",func(): state.resolve(id,actor,"decline"); review_offer(id,actor))
  elif actor==offer.from:
   button(content,"Retirer mon offre",func(): state.resolve(id,actor,"cancel"); review_offer(id,actor))
  if actor!=offer.to:
   button(content,"Passer l’appareil à "+state.names[offer.to],func(): review_offer(id,offer.to))
 else:
  text(content,{"accepted":"ACCORD CONCLU · Biens et soldes mis à jour.","declined":"OFFRE REFUSÉE · Aucun transfert.","cancelled":"OFFRE RETIRÉE · Aucun transfert.","expired":"OFFRE EXPIRÉE · Aucun transfert."}.get(offer.status,"Offre terminée"),20,GOLD)
 button(content,"Retour aux échanges",func(): show_page("trades"))
 resize_ui()


func players_page() -> void:
 header.text = "LES HUIT VOYAGEURS"
 for i in range(8):
  var player: int = i
  var panel := PanelContainer.new()
  panel.add_theme_stylebox_override("panel",style(Color("17343c"),host.pawns.COLORS[i],14))
  content.add_child(panel)
  var col := VBoxContainer.new()
  panel.add_child(col)
  text(col,state.names[i]+(" · À vous de jouer" if i==host.pawns.active else ""),20,host.pawns.COLORS[i])
  text(col,"%d € · %d propriétés" % [state.cash[i],state.portfolio(i).size()],16)
  if i!=host.pawns.active:
   button(col,"Proposer un échange",func():
    viewer = host.pawns.active
    partner = player
    selected_give.clear(); selected_receive.clear(); give_cash = 0; receive_cash = 0
    show_page("draft")
   )

func _input(event: InputEvent) -> void:
 if shade.visible and event is InputEventKey and event.pressed and event.keycode==KEY_ESCAPE:
  close()
  get_viewport().set_input_as_handled()


func _process(_delta: float) -> void:
 if not is_instance_valid(window) or not shade.visible: return
 var view := get_viewport().get_visible_rect().size
 var target := Vector2(minf(1120,view.x-24),minf(820,view.y-24))
 # Wrapping labels briefly increase container minimums during construction.
 # Reapply the viewport bounds after layout so only the content scrolls.
 if window.size.distance_to(target)>1.0: resize_ui()
