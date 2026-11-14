extends Node
## The original game engine owns all rules. This bridge only renders its snapshots.
var host: Node3D
var callback: JavaScriptObject
var browser: JavaScriptObject
var id_to_slot: Dictionary = {}
var targets: Dictionary = {}
var motion: Dictionary = {}
var dice_key := -1
var buildings: Dictionary = {}
var building_levels: Dictionary = {}

func setup(scene: Node3D) -> void:
 host = scene
 host.renderer_mode = true
 host.orbit = false
 host.follow_pawn = false
 host.distance = 34
 host.pitch = 1.05
 host.yaw = 0
 host.trading.visible = false
 host.legacy_ui.hide()
 host.dice_rig.muted = true
 for piece in host.pawns.pieces: piece.visible = false
 if OS.has_feature("web"):
  browser = JavaScriptBridge.get_interface("window")
  callback = JavaScriptBridge.create_callback(on_message)
  browser.addEventListener("message",callback)
  JavaScriptBridge.eval("window.parent.postMessage(JSON.stringify({type:'fortune-ready'}),window.location.origin)",true)

func on_message(args: Array) -> void:
 if args.is_empty(): return
 var event: JavaScriptObject = args[0]
 if str(event.origin)!=str(browser.location.origin) or typeof(event.data)!=TYPE_STRING: return
 var packet = JSON.parse_string(event.data)
 if packet is Dictionary and packet.get("type","")=="fortune-state": apply_frame(packet)

func apply_frame(packet: Dictionary) -> void:
 var state: Dictionary = packet.get("state",{})
 if not state.has("order"): return
 var cinema: Dictionary = packet.get("cinema",{})
 var order: Array = state.order
 var players: Dictionary = state.players
 var active_id: String = order[int(state.currentIndex)]
 for piece in host.pawns.pieces: piece.visible = false
 id_to_slot.clear()
 for rank in range(order.size()):
  var id: String = order[rank]
  var player: Dictionary = players[id]
  var slot := clampi(int(str(player.get("token","t1")).trim_prefix("t"))-1,0,7)
  id_to_slot[id] = slot
  var node: Node3D = host.pawns.pieces[slot]
  node.visible = not player.bankrupt
  var paint: StandardMaterial3D = node.get_meta("player_metal")
  paint.albedo_color = Color(str(player.get("color",host.pawns.COLORS[slot].to_html())))
  var tile := int(cinema.get("tokenTile",{}).get(id,player.position))
  var old: float = float(targets.get(id,tile))
  var current: int = posmod(int(round(old)),40)
  var diff := posmod(tile-current,40)
  if not targets.has(id):
   targets[id] = float(tile)
   host.pawns.indices[slot] = tile
   node.position = host.pawns.track[tile]
  elif diff!=0:
   if motion.has(id) and motion[id].is_running(): motion[id].kill()
   host.pawns.indices[slot] = tile
   if diff==1:
    targets[id] = old+1
    var tween := create_tween()
    var duration := 0.025 if packet.get("reduced",false) else 0.12
    host.pawns.last_crossed = int(old)
    tween.tween_method(func(value: float): host.pawns.apply_progress(value,slot,int(old),1,Vector3.ZERO),old,old+1,duration)
    motion[id] = tween
   else:
    targets[id] = float(tile)
    node.position = host.pawns.track[tile]
    node.get_node("Sculpture").rotation = Vector3.ZERO
  if motion.has(id) and motion[id].is_running(): continue
  node.position = host.pawns.track[tile]+host.pawns.slot(slot,tile)
  var forward: Vector3 = host.pawns.sample_track(float(tile)+0.02)-host.pawns.sample_track(float(tile))
  node.rotation.y = atan2(-forward.x,-forward.z)
  node.get_node("Sculpture").rotation = Vector3.ZERO
  node.get_node("Sculpture").position = Vector3.ZERO
 host.pawns.active = int(id_to_slot.get(active_id,0))
 host.pawns.busy = cinema.get("follow")!=null and bool(cinema.get("playing",false))
 var roll = cinema.get("dice")
 if roll is Dictionary and int(roll.get("key",-1))!=dice_key:
  dice_key = int(roll.key)
  var a := int(roll.values[0]);var b := int(roll.values[1])
  host.dice_rig.roll_pair(a,b,0.18 if packet.get("reduced",false) else 0.74)
 host.session.owners.clear()
 for key in state.tiles:
  var tile := int(key)
  var asset: Dictionary = state.tiles[key]
  if asset.owner!=null and id_to_slot.has(asset.owner): host.session.owners[tile] = id_to_slot[asset.owner]
  update_building(tile,int(asset.level))
 host.refresh_ownership()
 for key in state.tiles:
  var asset: Dictionary = state.tiles[key]
  if asset.owner!=null and host.owner_markers.has(int(key)):
   host.owner_markers[int(key)].material_override.albedo_color = Color(str(players[asset.owner].get("color", "#cfb276")))
 for key in host.owner_markers.keys():
  if not host.session.owners.has(key): host.owner_markers[key].hide()
  else: host.owner_markers[key].show()
 var highlight = cinema.get("highlight")
 if highlight!=null: host.selection.position = host.positions[int(highlight)]+Vector3(0,0.15,0)
 if browser!=null:
  browser.parent.postMessage(JSON.stringify({"type":"fortune-rendered","version":int(state.get("version",0))}),str(browser.location.origin))

func update_building(tile: int, level: int) -> void:
 if int(building_levels.get(tile,0))==level: return
 building_levels[tile] = level
 if buildings.has(tile):
  buildings[tile].queue_free()
  buildings.erase(tile)
 if level<=0: return
 var group := Node3D.new()
 host.add_child(group)
 group.position = host.positions[tile]+Vector3(0,0.38,0)
 group.rotation.y = -float(tile/10)*PI/2
 buildings[tile] = group
 var gold: Material = host.mat(Color("cfb276"),0.6)
 var walls: Material = host.mat(Color("c9c7aa"),0.1)
 var roof: Material = host.mat(Color("317c60") if level<5 else Color("9d4d50"),0.3)
 if level<5:
  for i in range(level):
   var x := -0.54+i*0.36
   host.box(group,Vector3(x,0.11,-0.68),Vector3(0.23,0.20,0.22),walls)
   var top: MeshInstance3D = host.cylinder(group,Vector3(x,0.26,-0.68),0.18,0.12,roof,0)
   top.mesh.radial_segments = 4
   top.rotation.y = PI/4
 else:
  host.box(group,Vector3(0,0.22,-0.62),Vector3(0.85,0.42,0.36),walls)
  host.box(group,Vector3(0,0.45,-0.62),Vector3(0.93,0.06,0.42),roof)
  for i in range(5): host.box(group,Vector3(-0.32+i*0.16,0.27,-0.43),Vector3(0.055,0.09,0.015),gold)
 group.scale = Vector3.ONE*0.01
 create_tween().tween_property(group,"scale",Vector3.ONE,0.40).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)

func _process(_delta: float) -> void:
 if not is_instance_valid(host): return
 host.orbit = false
 host.follow_pawn = false
 host.camera_target = Vector3.ZERO
 host.yaw = 0
