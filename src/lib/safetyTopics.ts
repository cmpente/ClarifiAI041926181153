export type SafetyTopic = {
  id: string;
  category: string;
  title: string;
  equipmentFocus: string;
  productType: string;
  hazardType: string;
  unsafeBehavior: string;
  safeBehavior: string;
  supervisorIntervention: string;
  environmentTags: string[];
  workerType: string;
};

export const TOPIC_CATEGORIES = [
  "conveyor_entanglement",
  "machine_guarding",
  "jam_clearing",
  "forklift_pedestrian",
  "pallet_jack_awareness",
  "washdown_protection",
  "slip_and_floor_condition",
  "bulk_bin_handling",
  "packaging_line_contact",
  "patty_line_contact",
  "pizza_line_intervention",
  "lockout_verification"
];

export const SUGGESTED_TOPICS: SafetyTopic[] = [
  {
    id: "conveyor_jam_01",
    category: "jam_clearing",
    title: "Clear Jam Only After Stop",
    equipmentFocus: "conveyor",
    productType: "small brown meat crumbles",
    hazardType: "entanglement",
    unsafeBehavior: "worker reaching into an active conveyor to clear a jam while product is still moving",
    safeBehavior: "worker clearing the jam only after the conveyor is stopped and safe",
    supervisorIntervention: "supervisor stopping the worker and directing proper stop-before-clear procedure",
    environmentTags: ["dense machinery", "wet floor", "overhead piping"],
    workerType: "male production worker"
  },
  {
    id: "washdown_hmi_01",
    category: "washdown_protection",
    title: "Cover HMI Before Washdown",
    equipmentFocus: "touchscreen HMI panel",
    productType: "None (line must be completely empty)",
    hazardType: "water intrusion and food cross-contamination",
    unsafeBehavior: "worker spraying washdown water directly onto an uncovered touchscreen HMI panel while food product is still physically on the belt",
    safeBehavior: "worker spraying equipment only after the HMI is fully covered with protective plastic AND ALL product has been removed from the belt",
    supervisorIntervention: "supervisor pointing to the covered panel and demonstrating correct protection setup and empty belt",
    environmentTags: ["wet floor", "stainless equipment", "tight aisle"],
    workerType: "senior line worker"
  },
  {
    id: "forklift_travel_01",
    category: "forklift_pedestrian",
    title: "Watch Forklift Travel Path",
    equipmentFocus: "Crown stand-up electric forklift",
    productType: "2000lb stainless steel bins",
    hazardType: "crushing",
    unsafeBehavior: "driving forklift forward blindly while view is obstructed by a large bin",
    safeBehavior: "driving forklift in reverse to ensure clear visibility, sounding horn at corners",
    supervisorIntervention: "supervisor signaling driver to stop and switch to reverse travel",
    environmentTags: ["wet reddish-brown epoxy floor", "tight pedestrian crossing", "blind corner"],
    workerType: "forklift operator"
  },
  {
    id: "pallet_jack_01",
    category: "pallet_jack_awareness",
    title: "Check Behind Pallet Jack",
    equipmentFocus: "manual pallet jack",
    productType: "stacked ingredient bags",
    hazardType: "pedestrian collision",
    unsafeBehavior: "pulling a heavy pallet jack backward without checking if someone is walking behind",
    safeBehavior: "checking over the shoulder before moving the pallet jack backward",
    supervisorIntervention: "supervisor alerting worker to look before stepping back",
    environmentTags: ["wet floor", "stainless tanks", "transfer area"],
    workerType: "material handler"
  },
  {
    id: "conveyor_reach_01",
    category: "conveyor_entanglement",
    title: "Do Not Reach Into Conveyor",
    equipmentFocus: "moving conveyor belt",
    productType: "raw sausage products",
    hazardType: "entanglement",
    unsafeBehavior: "worker reaching across a moving conveyor belt to grab a fallen item",
    safeBehavior: "worker stopping the belt or walking around to safely retrieve the item",
    supervisorIntervention: "supervisor warning the worker not to reach across the running belt",
    environmentTags: ["packaging equipment", "tight walkways", "overhead piping"],
    workerType: "packaging worker"
  },
  {
    id: "patty_line_01",
    category: "patty_line_contact",
    title: "Keep Clear Of Patty Line",
    equipmentFocus: "high-speed patty former",
    productType: "round meat patties",
    hazardType: "pinch point",
    unsafeBehavior: "worker resting hands near the active indexing mechanism of the patty line",
    safeBehavior: "worker keeping hands clear and using designated tools for adjustments",
    supervisorIntervention: "supervisor directing the worker to maintain safe hand distance",
    environmentTags: ["stainless machinery", "wet floor", "dense machinery"],
    workerType: "machine operator"
  },
  {
    id: "loto_clearing_01",
    category: "lockout_verification",
    title: "Lock Out Before Clearing",
    equipmentFocus: "conveyor equipment",
    productType: "round meat patties",
    hazardType: "stored energy, amputation",
    unsafeBehavior: "worker reaching into equipment with bare hands to clear a product jam without locking out the machine",
    safeBehavior: "worker using a scraper tool on the equipment ONLY after the machine is locked out and the belt is completely visible and safe",
    supervisorIntervention: "supervisor placing a red padlock on the main electrical panel to lock it out",
    environmentTags: ["conveyor line", "packaging area", "wet floor"],
    workerType: "mechanic or severe jam clearer"
  },
  {
    id: "conveyor_step_01",
    category: "conveyor_entanglement",
    title: "Do Not Step Over Conveyor",
    equipmentFocus: "ground-level conveyor",
    productType: "packaged meat boxes",
    hazardType: "entanglement and fall",
    unsafeBehavior: "worker attempting to step over a moving conveyor line",
    safeBehavior: "worker walking around using the designated crossover stairs",
    supervisorIntervention: "supervisor directing the worker to use the crossover stairs",
    environmentTags: ["corrugated walls", "epoxy floors", "packaging line"],
    workerType: "general laborer"
  }
];
