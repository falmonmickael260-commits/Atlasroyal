extends CanvasLayer
## Responsive local-table UI. No simulated online messages or hidden acceptance.
var opening_tween: Tween
var hud: Control
var modal_tabs: Array[Button] = []
var modal_tab_grid: GridContainer
var serif: Font = preload("res://assets/ui/EmpireSerif.ttf")
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
var offer_filter := "mine"
var counter_id := -1
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
 s.set_corner_radius_all(8)
 s.shadow_color = Color(0,0,0,0.22)
 s.shadow_size = 8
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
 b.add_theme_stylebox_override("normal",style(Color("c9ad78") if primary else Color("163139"),Color("3c5655"),10))
 b.add_theme_stylebox_override("hover",style(Color("dec58e") if primary else Color("2c535d"),GOLD,10))
 b.add_theme_stylebox_override("pressed",style(Color("b99b63") if primary else Color("294a50"),GOLD,10))
 b.add_theme_stylebox_override("disabled",style(Color("173039"),Color("2a4247"),10))
 b.add_theme_color_override("font_disabled_color",Color("6e8583"))
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
 header = text(head,"",30,GOLD)
 header.add_theme_font_override("font",serif)
 header.size_flags_horizontal = Control.SIZE_EXPAND_FILL
 button(head,"Fermer",close)
 var note := text(layout,"Votre table privée · Les échanges se concluent sur cet appareil.",13,Color("92aca9"))
 note.name = "LocalNote"
 var tabs := GridContainer.new()
 modal_tab_grid = tabs
 tabs.columns = 4
 tabs.add_theme_constant_override("h_separation",8)
 tabs.add_theme_constant_override("v_separation",6)
 layout.add_child(tabs)
 for entry in [["Propriétés","portfolio"],["Échanges","trades"],["Joueurs","players"],["Journal","journal"]]:
  var key: String = entry[1]
  var tab := button(tabs,entry[0],func(): show_page(key))
  tab.set_meta("page",key)
  tab.size_flags_horizontal = Control.SIZE_EXPAND_FILL
  modal_tabs.append(tab)
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
 bar.hide()
 hud = load("res://premium_hud.gd").new()
 root.add_child(hud)
 root.move_child(hud,root.get_children().find(shade))
 hud.setup(host,state,self)
 root.resized.connect(resize_ui)
 resize_ui()
 refresh_bar()

func resize_ui() -> void:
 if not is_instance_valid(bar): return
 var size := get_viewport().get_visible_rect().size
 var small := size.x<1000
 bar.visible = false
 if is_instance_valid(hud): hud.resize_hud()
 var w := minf(1060,size.x-24)
 modal_tab_grid.columns = 2 if size.x<700 else 4
 header.add_theme_font_size_override("font_size",25 if size.x<700 else 30)
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
 shade.modulate.a = 0.0
 if opening_tween and opening_tween.is_running(): opening_tween.kill()
 opening_tween = create_tween()
 opening_tween.tween_property(shade,"modulate:a",1.0,0.16).set_trans(Tween.TRANS_SINE)
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
 if target in ["portfolio","trades","players","journal"]: counter_id = -1
 clear_content()
 for tab in modal_tabs:
  tab.modulate = GOLD if tab.get_meta("page")==target else WHITE
 header.text = {"portfolio":"Votre patrimoine","trades":"Le comptoir des échanges","journal":"Le journal de votre empire"}.get(page,"ÉCHANGE")
 if page=="players": players_page()
 elif page=="board": board_page()
 elif page=="portfolio": portfolio_page()
 elif page=="trades": offers_page()
 elif page=="draft": draft_page()
 elif page=="journal":
  if state.journal.is_empty(): text(content,"Votre histoire commence au prochain lancer.")
  for event in state.journal: text(content,"•  "+event,16)
 resize_ui()

func open_player(player: int) -> void:
 if host.moving: return
 open("portfolio")
 viewer = player
 show_page("portfolio")

func portfolio_page() -> void:
 if viewer!=host.pawns.active:
  var owner := viewer
  button(content,"Négocier avec "+state.names[owner],func():
   viewer = host.pawns.active
   partner = owner
   selected_give.clear(); selected_receive.clear(); give_cash = 0; receive_cash = 0; counter_id = -1
   show_page("draft")
  ,true)
 var title := text(content,state.names[viewer],27,WHITE)
 title.add_theme_font_override("font",serif)
 var stats := GridContainer.new()
 stats.columns = 2
 stats.add_theme_constant_override("h_separation",14)
 content.add_child(stats)
 for metric in [["TRÉSORERIE","%d €" % state.cash[viewer]],["PROPRIÉTÉS",str(state.portfolio(viewer).size())]]:
  var card := PanelContainer.new()
  card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
  card.add_theme_stylebox_override("panel",style(Color("142f35"),Color("51665b"),16))
  stats.add_child(card)
  var col := VBoxContainer.new()
  card.add_child(col)
  text(col,metric[0],11,Color("a5b7ad"))
  var amount := text(col,metric[1],30,GOLD)
  amount.add_theme_font_override("font",serif)
 button(content,"Explorer les 40 cases",func(): show_page("board"))
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
 var preview := TextureRect.new()
 preview.texture = load("res://assets/cases/%02d.svg" % tile)
 preview.custom_minimum_size = Vector2(54,64)
 preview.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
 preview.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
 row.add_child(preview)
 if selectable:
  var check := CheckBox.new()
  check.button_pressed = selection.has(tile)
  check.add_theme_icon_override("checked",load("res://assets/ui/check-on.svg"))
  check.add_theme_icon_override("unchecked",load("res://assets/ui/check-off.svg"))
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
 var name_label := text(col,str(state.tiles[tile].name),20)
 name_label.add_theme_font_override("font",serif)
 text(col,"%s · valeur %d €" % [state.tiles[tile].get("country","Escale spéciale"),state.price(tile)],13,Color("a4bbb4"))
 if incoming: text(col,"À RECEVOIR",12,GOLD)
 if not selectable:
  button(row,"Voir",func():
   close()
   host.select_tile(tile)
   host.focus_tile()
  )

func offer_bundle(assets: Array, money: int) -> String:
 var parts := PackedStringArray()
 for tile in assets: parts.append(str(state.tiles[tile].name))
 if money>0 or parts.is_empty(): parts.append("%d €" % money)
 return " + ".join(parts)

func offers_page() -> void:
 viewer = host.pawns.active
 var filters := GridContainer.new()
 filters.columns = 2 if get_viewport().get_visible_rect().size.x<700 else 4
 content.add_child(filters)
 for item in [["Mes échanges","mine"],["Reçus","received"],["Envoyés","sent"],["Tous","all"]]:
  var key: String = item[1]
  var tab := button(filters,item[0],func(): offer_filter = key; show_page("trades"))
  tab.size_flags_horizontal = Control.SIZE_EXPAND_FILL
  tab.modulate = GOLD if key==offer_filter else WHITE
 button(footer_actions,"Nouvelle proposition",func():
  selected_give.clear(); selected_receive.clear(); give_cash = 0; receive_cash = 0; counter_id = -1
  partner = (viewer+1)%8
  show_page("draft")
 ,true)
 var count := 0
 for offer in state.offers:
  if offer_filter=="mine" and offer.from!=viewer and offer.to!=viewer: continue
  if offer_filter=="received" and offer.to!=viewer: continue
  if offer_filter=="sent" and offer.from!=viewer: continue
  count += 1
  var card := PanelContainer.new()
  card.add_theme_stylebox_override("panel",style(Color("153139"),Color("5a6959"),18))
  content.add_child(card)
  var box := VBoxContainer.new()
  box.add_theme_constant_override("separation",10)
  card.add_child(box)
  var status_text: String = {"pending":"EN ATTENTE","accepted":"ACCORD CONCLU","declined":"REFUSÉE","cancelled":"RETIRÉE","expired":"EXPIRÉE","countered":"CONTRE-PROPOSITION"}.get(offer.status,offer.status)
  text(box,"OFFRE %02d  /  %s" % [offer.id,status_text],12,Color("91c3ab") if offer.status=="accepted" else GOLD)
  var names_label := text(box,"%s → %s" % [state.names[offer.from],state.names[offer.to]],21)
  names_label.add_theme_font_override("font",serif)
  text(box,offer_bundle(offer.give,offer.payment)+"
contre "+offer_bundle(offer.receive,offer.requested),16,Color("b3c7bf"))
  button(box,"Examiner l’offre",func(): review_offer(offer.id,viewer))
 if count==0:
  var empty := text(content,"Vos prochaines alliances commencent ici.",25,GOLD)
  empty.add_theme_font_override("font",serif)
  text(content,"Aucune offre dans cette vue. Choisissez un autre filtre ou composez une proposition.",16,Color("a4b9b1"))

var summary: Label
func draft_page() -> void:
 header.text = "Répondre par une contre-proposition" if counter_id>=0 else "Proposer un échange"
 text(content,"Négocier avec",16,Color("a9bdb6"))
 recipient_picker = OptionButton.new()
 recipient_picker.custom_minimum_size.y = 46
 recipient_picker.disabled = counter_id>=0
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
 portrait_columns.add_theme_constant_override("h_separation",28)
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
 var result: Dictionary = state.counter_offer(counter_id,viewer,selected_give,selected_receive,give_cash,receive_cash) if counter_id>=0 else state.propose(viewer,partner,selected_give,selected_receive,give_cash,receive_cash)
 if result.has("error"): alert.text = result.error; return
 counter_id = -1
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
 portrait_columns.add_theme_constant_override("h_separation",28)
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
   button(content,"Faire une contre-proposition",func(): prepare_counter(id,actor))
   button(content,"Refuser",func(): state.resolve(id,actor,"decline"); review_offer(id,actor))
  elif actor==offer.from:
   button(content,"Retirer mon offre",func(): state.resolve(id,actor,"cancel"); review_offer(id,actor))
  if actor!=offer.to:
   button(content,"Passer l’appareil à "+state.names[offer.to],func(): review_offer(id,offer.to))
 else:
  text(content,{"accepted":"ACCORD CONCLU · Biens et soldes mis à jour.","declined":"OFFRE REFUSÉE · Aucun transfert.","cancelled":"OFFRE RETIRÉE · Aucun transfert.","expired":"OFFRE EXPIRÉE · Aucun transfert.","countered":"Une contre-proposition remplace cette offre. Consultez vos échanges."}.get(offer.status,"Offre terminée"),20,GOLD)
 button(content,"Retour aux échanges",func(): show_page("trades"))
 resize_ui()


func players_page() -> void:
 header.text = "Les investisseurs"
 var sound := button(content,"Son des dés : "+("coupé" if host.dice_rig.muted else "activé"),func():
  host.dice_rig.muted = not host.dice_rig.muted
  show_page("players")
 )
 sound.tooltip_text = "Activer ou couper les sons du lancer."
 for i in range(8):
  var player: int = i
  var panel := PanelContainer.new()
  panel.add_theme_stylebox_override("panel",style(Color("17343c"),host.pawns.COLORS[i],14))
  content.add_child(panel)
  var col := VBoxContainer.new()
  panel.add_child(col)
  text(col,state.names[i]+(" · À vous de jouer" if i==host.pawns.active else ""),20,host.pawns.COLORS[i])
  text(col,"%d € · %d propriétés" % [state.cash[i],state.portfolio(i).size()],16)
  button(col,"Voir le patrimoine",func(): open_player(player))
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
 if is_instance_valid(alert): alert.visible = not alert.text.is_empty()
 if not is_instance_valid(window) or not shade.visible: return
 var view := get_viewport().get_visible_rect().size
 var target := Vector2(minf(1060,view.x-24),minf(820,view.y-24))
 # Wrapping labels briefly increase container minimums during construction.
 # Reapply the viewport bounds after layout so only the content scrolls.
 if window.size.distance_to(target)>1.0: resize_ui()


func board_page() -> void:
 header.text = "Les escales de votre empire"
 text(content,"Choisissez une escale pour la découvrir de près.",16,Color("a2b8b1"))
 for tile in range(state.tiles.size()): property_card(content,tile,false,[],false)


func prepare_counter(id: int, actor: int) -> void:
 var offer: Dictionary = state.find_offer(id)
 if offer.is_empty() or offer.status!="pending" or offer.to!=actor: return
 viewer = actor
 partner = offer.from
 counter_id = id
 selected_give.assign(offer.receive)
 selected_receive.assign(offer.give)
 give_cash = offer.requested
 receive_cash = offer.payment
 show_page("draft")
