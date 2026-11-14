extends SceneTree
var failures := 0
func check(condition: bool, message: String) -> void:
 if not condition: push_error(message); failures += 1
func _initialize() -> void: call_deferred("run")
func run() -> void:
 var dice = load("res://premium_dice.gd").new()
 root.add_child(dice)
 dice.muted = true
 var rig = load("res://pawns.gd").new()
 root.add_child(rig)
 var positions: Array[Vector3] = []
 for i in range(40):
  var side := i/10
  var n := i%10
  positions.append([Vector3(9-n*1.8,0,9),Vector3(-9,0,9-n*1.8),Vector3(-9+n*1.8,0,-9),Vector3(9,0,-9+n*1.8)][side])
 rig.setup(positions)
 var crossings := {"count":0}
 rig.crossed_tile.connect(func(_index: int): crossings.count += 1)
 for a in range(1,7):
  for b in range(1,7):
   var valid: bool = await dice.roll_pair(a,b,0.01)
   check(valid,"Animation must settle on the selected values")
   var shown: Array[int] = dice.top_values()
   check(shown==[a,b],"Visible upper faces must match authoritative result")
   var total: int = shown[0]+shown[1]
   var piece: int = rig.active
   var before: int = rig.indices[piece]
   crossings.count = 0
   await rig.move_active(total,0.01)
   check(rig.indices[piece]==(before+a+b)%40,"Distance must match dice total")
   check(crossings.count==total,"Exact number of visited cases for every combination")
 var rejected: bool = await dice.roll_pair(0,7,0.01)
 check(not rejected,"Reject values outside 1–6")
 # Every face remains correct under arbitrary yaw.
 for value in range(1,7):
  for angle in [0.0,0.8,PI,5.2]:
   dice.dice[0].quaternion = dice.orientation_for(value,angle)
   check(dice.top_value(0)==value,"Top face independent of yaw")
 print("DICE: ","PASS · 36 combinations, visible faces, exact movement counts and yaw" if failures==0 else str(failures)+" failures")
 quit(0 if failures==0 else 1)
