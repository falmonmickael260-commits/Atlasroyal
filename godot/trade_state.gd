extends RefCounted
## Local session authority. All purchases and trades are validated here.
signal changed
var tiles: Array = []
var names: Array = []
var cash: Array[int] = []
var owners: Dictionary = {}
var offers: Array[Dictionary] = []
var journal: Array[String] = []
var next_id := 1
var demo := false

func setup(board: Array, player_names: Array) -> void:
 tiles = board
 names = player_names.duplicate()
 for _name in names: cash.append(2500)

func price(tile: int) -> int:
 if tile<0 or tile>=tiles.size(): return 0
 var t: Dictionary = tiles[tile]
 if t.kind=="hub": return 200
 if t.kind=="reseau": return 150
 return int(t.get("price",0)) if t.kind=="city" else 0

func portfolio(player: int) -> Array[int]:
 var result: Array[int] = []
 for i in range(tiles.size()):
  if owners.get(i,-1)==player: result.append(i)
 return result

func log_event(message: String) -> void:
 journal.push_front(message)
 changed.emit()

func buy(player: int, tile: int) -> String:
 if player<0 or player>=names.size(): return "Joueur inconnu."
 var amount := price(tile)
 if amount<=0: return "Cette case ne peut pas être achetée."
 if owners.has(tile): return "Cette propriété appartient déjà à un joueur."
 if cash[player]<amount: return "Solde insuffisant."
 cash[player] -= amount
 owners[tile] = player
 log_event("%s achète %s pour %d €." % [names[player],tiles[tile].name,amount])
 return ""

func validate(from: int, to: int, give: Array, receive: Array, payment: int, requested: int) -> String:
 if from<0 or to<0 or from>=names.size() or to>=names.size() or from==to: return "Choisissez un autre joueur."
 if payment<0 or requested<0: return "Les montants doivent être positifs ou nuls."
 if cash[from]<payment or cash[to]<requested: return "L’un des joueurs n’a plus le solde nécessaire."
 if give.is_empty() and payment==0: return "Ajoutez une contrepartie de votre côté."
 if receive.is_empty() and requested==0: return "Ajoutez une contrepartie du partenaire."
 var seen := {}
 for i in give:
  if typeof(i)!=TYPE_INT or seen.has(i) or owners.get(i,-1)!=from: return "Une propriété offerte n’est plus disponible."
  seen[i] = true
 for i in receive:
  if typeof(i)!=TYPE_INT or seen.has(i) or owners.get(i,-1)!=to: return "Une propriété demandée n’est plus disponible."
  seen[i] = true
 return ""

func propose(from: int, to: int, give: Array, receive: Array, payment: int, requested: int) -> Dictionary:
 var error := validate(from,to,give,receive,payment,requested)
 if not error.is_empty(): return {"error":error}
 var offer := {"id":next_id,"from":from,"to":to,"give":give.duplicate(),"receive":receive.duplicate(),"payment":payment,"requested":requested,"status":"pending"}
 next_id += 1
 offers.push_front(offer)
 log_event("Offre #%d : %s propose un échange à %s." % [offer.id,names[from],names[to]])
 return {"id":offer.id}

func find_offer(id: int) -> Dictionary:
 for offer in offers:
  if offer.id==id: return offer
 return {}

func resolve(id: int, actor: int, action: String) -> String:
 var offer := find_offer(id)
 if offer.is_empty() or offer.status!="pending": return "Cette offre n’est plus en attente."
 if action=="cancel":
  if actor!=offer.from: return "Seul l’auteur peut retirer l’offre."
  offer.status = "cancelled"
 elif action=="decline":
  if actor!=offer.to: return "Seul le destinataire peut refuser."
  offer.status = "declined"
 elif action=="accept":
  if actor!=offer.to: return "Seul le destinataire peut accepter."
  var error := validate(offer.from,offer.to,offer.give,offer.receive,offer.payment,offer.requested)
  if not error.is_empty():
   offer.status = "expired"
   log_event("Offre #%d expirée : %s" % [id,error])
   return error
  # Validation completes before any mutation; the transfer is atomic.
  cash[offer.from] += offer.requested-offer.payment
  cash[offer.to] += offer.payment-offer.requested
  for tile in offer.give: owners[tile] = offer.to
  for tile in offer.receive: owners[tile] = offer.from
  offer.status = "accepted"
 else: return "Action inconnue."
 log_event("Offre #%d · %s." % [id,{"accepted":"échange conclu","declined":"refusée","cancelled":"retirée"}.get(offer.status,offer.status)])
 return ""

func seed_demo() -> bool:
 if not owners.is_empty() or not offers.is_empty(): return false
 var cities: Array[int] = []
 for i in range(tiles.size()):
  if tiles[i].kind=="city": cities.append(i)
 for i in range(mini(cities.size(),names.size()*2)): owners[cities[i]] = i/2
 demo = true
 log_event("Partie d’essai locale : deux villes attribuées à chaque joueur. Soldes de départ : 2 500 €.")
 return true
