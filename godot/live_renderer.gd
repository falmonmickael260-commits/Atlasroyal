extends Node
## The original game engine owns all rules. This bridge only renders its snapshots.
var host: Node3D
var callback: JavaScriptObject
var browser: JavaScriptObject
var id_to_slot: Dictionary = {}
var targets: Dictionary = {}
var motion: Dictionary = {}
var progress: Dictionary = {}
var departure_offsets: Dictionary = {}
var dice_key := -1
var pending_roll: Dictionary = {}
var buildings: Dictionary = {}
var building_levels: Dictionary = {}
var label_clock := 0.0

func setup(scene: Node3D) -> void:
 host = scene
 host.renderer_mode = true
 Engine.max_fps = 5
 host.orbit = false
 host.follow_pawn = false
 host.distance = 34
 host.pitch = 1.05
 host.yaw = 0
 if is_instance_valid(host.trading): host.trading.visible = false
 if is_instance_valid(host.legacy_ui): host.legacy_ui.hide()
 host.dice_rig.muted = true
 host.dice_rig.hide()
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
 Engine.max_fps = 30
 var cinema: Dictionary = packet.get("cinema",{})
 var order: Array = state.order
 var players: Dictionary = state.players
 var active_id: String = str(cinema.get("actor") if cinema.get("actor")!=null else order[int(state.currentIndex)])
 for piece in host.pawns.pieces: piece.visible = false
 # Resolve every occupant before choosing parking slots (independent of turn order).
 for id in order:
  var player: Dictionary = players[id]
  var slot := clampi(int(str(player.get("token","t1")).trim_prefix("t"))-1,0,7)
  host.pawns.pieces[slot].visible = not player.bankrupt
  host.pawns.indices[slot] = int(cinema.get("tokenTile",{}).get(id,player.position))
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
  var travel = cinema.get("travel")
  var has_step: bool = travel is Dictionary and str(travel.get("player",""))==id and int(travel.get("to",-1))==tile
  if not targets.has(id):
   targets[id] = float(tile)
   progress[id] = float(tile)
   park_piece(slot,tile)
  elif diff!=0:
   if motion.has(id) and motion[id].is_running(): motion[id].kill()
   if diff==1 or (diff==39 and has_step):
    animate_step(id,slot,old,tile,travel if has_step else {},bool(packet.get("reduced",false)))
   else:
    # Jail, reconnects and direct card transfers do not invent visited tiles.
    targets[id] = float(tile)
    progress[id] = float(tile)
    park_piece(slot,tile)
  if motion.has(id) and motion[id].is_running(): continue
  if has_step and int(travel.step)<int(travel.total): continue
  var destination: Vector3 = host.pawns.track[tile]+host.pawns.slot(slot,tile)
  if node.position.distance_to(destination)>0.001:
   var parking := create_tween()
   parking.tween_property(node,"position",destination,0.04 if packet.get("reduced",false) else 0.16).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
   motion[id] = parking
  host.pawns.rest_pose(slot)
 host.pawns.active = int(id_to_slot.get(active_id,0))
 host.pawns.busy = cinema.get("follow")!=null and bool(cinema.get("playing",false))
 var roll = cinema.get("dice")
 if roll is Dictionary and int(roll.get("key",-1))!=dice_key:
  dice_key = int(roll.key)
  pending_roll = {"a":int(roll.values[0]),"b":int(roll.values[1]),"duration":0.1804 if packet.get("reduced",false) else 0.82,"reduced":bool(packet.get("reduced",false))}
  play_pending_dice()
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

func park_piece(slot: int, tile: int) -> void:
 var node: Node3D = host.pawns.pieces[slot]
 node.position = host.pawns.track[tile]+host.pawns.slot(slot,tile)
 var forward: Vector3 = host.pawns.sample_track(float(tile)+0.02)-host.pawns.sample_track(float(tile))
 node.rotation.y = atan2(-forward.x,-forward.z)
 host.pawns.rest_pose(slot)

func animate_step(id: String, slot: int, old: float, tile: int, travel: Dictionary, reduced: bool) -> void:
 var direction := -1 if posmod(tile-posmod(int(round(old)),40),40)==39 else 1
 var step := maxi(1,int(travel.get("step",1)))
 var total := maxi(step,int(travel.get("total",1)))
 var start := int(round(old))-direction*(step-1)
 var finish := old+direction
 var from: float = float(progress.get(id,old))
 var node: Node3D = host.pawns.pieces[slot]
 if step==1:
  departure_offsets[id] = node.position-host.pawns.sample_track(from)
 var origin: Vector3 = departure_offsets.get(id,Vector3.ZERO)
 targets[id] = finish
 var duration := clampf(float(travel.get("duration",0.16)),0.025,0.22)
 if reduced: duration = minf(duration,0.035)
 var tween := create_tween()
 if step==1: tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
 elif step==total: tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
 host.pawns.last_crossed = int(floor(from)) if direction>0 else int(ceil(from))
 tween.tween_method(func(value: float):
  progress[id] = value
  host.pawns.apply_progress(value,slot,start,total*direction,origin)
  if step==total:
   var parked: Vector3 = host.pawns.slot(slot,tile)
   var fraction := 1.0-absf(finish-value)
   node.position += parked*smoothstep(0.20,1.0,fraction)
 ,from,finish,duration)
 if step==total:
  tween.tween_callback(func():
   node.position = host.pawns.track[tile]+host.pawns.slot(slot,tile)
   host.pawns.rest_pose(slot)
  )
 motion[id] = tween

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
 # Small architectural details share materials and are merged per property.
 var stone: Material = host.mat(Color("8a9589"),0.0,0.9)
 var walls: Material = host.mat(Color("d2ccb3"),0.0,0.85)
 var glass: Material = host.mat(Color("23474b"),0.15,0.45)
 var timber: Material = host.mat(Color("65503d"),0.0,0.85)
 var roof: Material = host.mat(Color("376a57") if level<5 else Color("864b4d"),0.05,0.8)
 if level<5:
  for i in range(level):
   var x := -0.54+i*0.36
   host.box(group,Vector3(x,0.025,-0.65),Vector3(0.29,0.05,0.30),stone)
   host.box(group,Vector3(x,0.15,-0.65),Vector3(0.24,0.22,0.23),walls)
   var gable := PrismMesh.new()
   gable.size = Vector3(0.30,0.14,0.30)
   host.mesh(group,gable,Vector3(x,0.32,-0.65),roof)
   host.box(group,Vector3(x-0.047,0.12,-0.527),Vector3(0.045,0.13,0.012),timber)
   host.box(group,Vector3(x+0.062,0.18,-0.527),Vector3(0.055,0.065,0.012),glass)
   host.box(group,Vector3(x+0.075,0.32,-0.70),Vector3(0.045,0.17,0.05),stone)
 else:
  host.box(group,Vector3(0,0.035,-0.62),Vector3(1.02,0.07,0.48),stone)
  host.box(group,Vector3(0,0.27,-0.62),Vector3(0.87,0.46,0.35),walls)
  host.box(group,Vector3(0,0.53,-0.62),Vector3(0.95,0.08,0.43),roof)
  host.box(group,Vector3(0,0.29,-0.43),Vector3(0.24,0.50,0.035),stone)
  host.box(group,Vector3(0,0.13,-0.402),Vector3(0.12,0.19,0.018),glass)
  host.box(group,Vector3(0,0.24,-0.35),Vector3(0.29,0.035,0.20),roof)
  for floor in range(3):
   for x in [-0.33,-0.20,0.20,0.33]:
    host.box(group,Vector3(x,0.14+floor*0.13,-0.438),Vector3(0.065,0.075,0.015),glass)
  for x in [-0.30,0.30]:
   host.box(group,Vector3(x,0.59,-0.62),Vector3(0.16,0.06,0.20),stone)
 load("res://static_batch.gd").bake(group,[])
 group.scale = Vector3.ONE*0.01
 create_tween().tween_property(group,"scale",Vector3.ONE,0.40).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)

func play_pending_dice() -> void:
 if pending_roll.is_empty() or host.dice_rig.busy: return
 var roll := pending_roll.duplicate()
 pending_roll.clear()
 host.dice_rig.show()
 host.dice_rig.reduced_motion = bool(roll.get("reduced",false))
 host.dice_rig.roll_pair(int(roll.a),int(roll.b),float(roll.duration))

func send_player_labels() -> void:
 if browser==null: return
 var positions := {}
 var stacks := {}
 for id in id_to_slot:
  var slot: int = id_to_slot[id]
  var piece: Node3D = host.pawns.pieces[slot]
  var at: Vector3 = piece.position
  var edge := maxf(absf(at.x),absf(at.z))
  if edge>0: at -= Vector3(at.x/edge,0,at.z/edge)*1.5
  at.y = 0.65
  var point: Vector2 = host.camera.unproject_position(at)
  var tile: int = host.pawns.indices[slot]
  var stack: int = stacks.get(tile,0)
  stacks[tile] = stack+1
  positions[id] = {"x":point.x,"y":point.y,"visible":piece.visible and not host.camera.is_position_behind(at),"stack":stack}
 var viewport_size: Vector2 = host.get_viewport().get_visible_rect().size
 browser.parent.postMessage(JSON.stringify({"type":"fortune-pawns","positions":positions,"width":viewport_size.x,"height":viewport_size.y}),str(browser.location.origin))

func _process(_delta: float) -> void:
 if not is_instance_valid(host): return
 play_pending_dice()
 label_clock += _delta
 if label_clock>=0.067:
  label_clock = 0
  send_player_labels()
 host.orbit = false
 host.follow_pawn = false
 host.camera_target = Vector3.ZERO
 host.yaw = 0
