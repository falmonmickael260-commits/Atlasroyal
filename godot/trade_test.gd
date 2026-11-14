extends SceneTree
var failures := 0
func check(condition: bool, message: String) -> void:
 if not condition: push_error(message); failures += 1
func _initialize() -> void: call_deferred("run")
func run() -> void:
 var state = load("res://trade_state.gd").new()
 var board: Array = JSON.parse_string(FileAccess.get_file_as_string("res://assets/board.json"))
 state.setup(board,["A","B","C","D","E","F","G","H"])
 check(state.price(5)==200 and state.price(12)==150,"Hub and network prices")
 check(state.buy(0,1).is_empty(),"Buy free property")
 check(state.buy(1,1)!="","Cannot buy another player's asset")
 check(state.buy(0,2)!="","Cannot buy card tiles")
 check(state.buy(1,3).is_empty(),"Other player buys")
 var total: int = state.cash[0]+state.cash[1]
 var offer: Dictionary = state.propose(0,1,[1],[3],100,20)
 check(not offer.has("error"),"Valid proposal")
 check(state.owners[1]==0 and state.cash[0]==2440,"Proposal has no financial effects")
 check(state.resolve(offer.id,0,"accept")!="","Author cannot accept")
 check(state.resolve(offer.id,1,"accept").is_empty(),"Recipient accepts")
 check(state.owners[1]==1 and state.owners[3]==0,"Titles transferred")
 check(state.cash[0]==2360 and state.cash[1]==2520,"Cash transferred in both directions")
 check(state.cash[0]+state.cash[1]==total,"Money conserved")
 check(state.resolve(offer.id,1,"accept")!="","Cannot execute twice")
 check(state.propose(0,0,[3],[],0,20).has("error"),"Self exchange forbidden")
 check(state.propose(0,1,[3,3],[1],0,0).has("error"),"Duplicate titles forbidden")
 check(state.propose(0,1,[],[1],-5,0).has("error"),"Negative money forbidden")
 check(state.propose(0,1,[],[1],0,0).has("error"),"Both sides need consideration")
 var stale: Dictionary = state.propose(0,1,[3],[1],0,0)
 state.owners[3] = 2
 var snapshot: Array = state.cash.duplicate()
 check(state.resolve(stale.id,1,"accept")!="","Revalidate ownership at acceptance")
 check(state.cash==snapshot and state.owners[1]==1,"Expired offers are atomic")
 check(state.find_offer(stale.id).status=="expired","Expired status")
 state.owners[3] = 0
 var poor: Dictionary = state.propose(0,1,[3],[1],100,0)
 state.cash[0] = 50
 check(state.resolve(poor.id,1,"accept")!="","Revalidate money at acceptance")
 var declined: Dictionary = state.propose(0,1,[3],[1],0,0)
 check(state.resolve(declined.id,1,"decline").is_empty(),"Decline offer")
 check(state.owners[3]==0 and state.owners[1]==1,"Decline has no effects")
 var cancelled: Dictionary = state.propose(0,1,[3],[1],0,0)
 check(state.resolve(cancelled.id,0,"cancel").is_empty(),"Withdraw own offer")
 check(not state.seed_demo(),"Demo cannot reset existing play")
 print("TRADE TESTS: ","PASS" if failures==0 else str(failures)+" failures")
 quit(0 if failures==0 else 1)
