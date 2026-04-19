import { prng } from "../utils/random";

export const ACTION_TEMPLATES: Record<string, string[]> = {
  "Raw Meat Formulation & Blending": [
    "Dumping 50lb spice bags into the blender hopper without ergonomic lifting techniques",
    "Reaching into the ribbon blender to clear a meat bridge while it is energized",
    "Standing on the rim of the combo dumper to dislodge frozen meat blocks",
    "Manually scraping the blender walls while the ribbons are rotating",
    "Lifting heavy meat combos without mechanical assistance on a wet floor",
    "Adding liquid smoke ingredients without wearing chemical-resistant goggles",
    "Walking under a suspended combo bin during dumping operations",
    "Using a damaged plastic shovel that could create foreign material contamination",
    "Overfilling the blender causing raw meat to spill onto the walkway",
    "Operating the lift dumper with bypassed safety gate interlocks"
  ],
  "Grinding & Extrusion": [
    "Clearing a bone jam from the primary grinder inlet with a hand tool while running",
    "Disassembling the grinder plate housing without performing Lockout/Tagout",
    "Using a non-detectable plastic scraper near the moving auger",
    "Operating the grinder with the safety hopper guard removed",
    "Standing on wet grating while using high-pressure water on electrical motors",
    "Reaching past the light curtain to adjust the extrusion flow",
    "Handling sharp grinder knives and plates without cut-resistant gloves",
    "Leaving the bone collector discharge chute open during operation",
    "Wearing a loose frock sleeve near the rotating auger shaft",
    "Using an air hose to clean meat dust, creating an airborne hazard"
  ],
  "Patty Forming (Formax)": [
    "Reaching into the mold plate area to remove a double patty while machine is cycling",
    "Bypassing the paper feed interlock to speed up a changeover",
    "Cleaning the knockout cups with the air pressure still connected",
    "Adjusting the fill pressure while the pump is actively pushing meat",
    "Standing on the machine frame to reach the upper hopper sensor",
    "Handling the heavy mold plate during changeover without a team lift",
    "Operating the patty former with the discharge conveyor guard missing",
    "Using a metal tool to scrape the tooling plate, creating metal shavings",
    "Ignoring the low-pressure hydraulic alarm and continuing to run",
    "Walking on the slippery forming platform without non-slip footwear"
  ],
  "Continuous Cooking & Ovens": [
    "Opening the oven side door to inspect product while the burner is firing",
    "Reaching under the oven belt to retrieve fallen patties during operation",
    "Walking on top of the oven housing without fall protection",
    "Cleaning the exhaust hood sensors without cooling down the oven",
    "Entering the spiral oven enclosure without verifying atmospheric safety",
    "Using a water hose near the thermal fluid piping system",
    "Adjusting the flame sensor while standing on a ladder over the line",
    "Handling hot oven racks without thermal protective gloves",
    "Ignoring a grease fire alarm to finish the production run",
    "Leaving the steam injection valve open during maintenance"
  ],
  "Sausage Crumble Processing": [
    "Reaching into the dicer infeed to orient a log while blades are spinning",
    "Clearing a blockage in the sizing screen with bare hands",
    "Standing in the direct path of the steam exhaust plume",
    "Manually guiding hot crumble on the belt without a tool",
    "Cleaning the underside of the conveyor while the belt is moving",
    "Operating the IQF tunnel with the access doors unlatched",
    "Walking through a cloud of spice dust without a respirator",
    "Lifting heavy catch pans of rework crumble above shoulder height",
    "Using a knife to cut plastic casing near the moving dicer blades",
    "Slipping on animal fat accumulation near the cooker discharge"
  ],
  "Spiral Freezing & Chilling": [
    "Entering the -40F spiral freezer without a buddy or radio",
    "Chipping ice off the evaporator fans while they are rotating",
    "Walking on the ice-slicked freezer floor without crampons/cleats",
    "Attempting to unjam the spiral belt drive while it is under tension",
    "Staying inside the freezer for over an hour without a warm-up break",
    "Touching sub-zero metal surfaces with bare hands",
    "Locking the emergency exit door from the outside by mistake",
    "Using a forklift inside the freezer with poor visibility due to fog",
    "Cleaning the freezer coils with high-pressure water without isolation",
    "Wearing wet PPE into the deep freeze zone"
  ],
  "RTE (Ready-to-Eat) Packaging": [
    "Reaching into the thermoformer sealing die to move a package",
    "Bypassing the light curtain on the case packer to clear a jam",
    "Using a box cutter to slice film near the product conveyor",
    "Lifting heavy film rolls onto the machine without a lift assist",
    "Walking between the robot palletizer arm and the safety fence",
    "Cleaning the slicing blade without the safety cover in place",
    "Wearing jewelry or loose items that could fall into finished product",
    "Touching RTE product after touching a raw zone surface (Cross-contamination)",
    "Operating the labeler with the pinch point guard removed",
    "Stacking pallets too high in the staging area causing instability"
  ],
  "Sanitation & Washdown": [
    "Spraying high-pressure hot water into an electrical control panel",
    "Mixing acid and chlorine cleaners creating toxic gas",
    "Entering a confined space tank for cleaning without a permit",
    "Using a ladder on a soapy, slippery floor to reach overhead pipes",
    "Spraying chemicals overhead without a face shield and goggles",
    "Walking blindly through a thick fog of sanitation steam",
    "Handling concentrated caustic chemicals with torn gloves",
    "Leaving a hose running on the floor creating a trip hazard",
    "Using high pressure to clean a drain, creating bacterial aerosol",
    "Locking oneself in a room during the sanitation cycle"
  ],
  "Material Handling & Forklifts": [
    "Driving a forklift with the forks elevated and loaded with a meat combo",
    "Speeding around a blind corner in the warehouse without honking",
    "Parking a pallet jack in front of an emergency exit",
    "Lifting a person on the forks to reach a high shelf",
    "Driving over a dock plate that is not secured",
    "Loading a trailer without chocking the wheels",
    "Operating a stand-up reach truck without the deadman pedal engaged",
    "Stacking pallets of frozen meat three high without wrapping",
    "Walking through a forklift-only door into traffic",
    "Using a forklift to push a line of heavy vats (bulldozing)"
  ],
  "Maintenance & LOTO": [
    "Working on a conveyor motor with only the E-stop pressed (No LOTO)",
    "Using a pair of pliers instead of the proper wrench, causing a slip",
    "Welding a bracket near flammable packaging materials without a fire watch",
    "Testing a live electrical circuit without arc flash PPE",
    "Lubricating a chain drive while it is running at full speed",
    "Standing on the top rung of a ladder to change a light bulb",
    "Leaving tools inside a machine after a repair",
    "Bypassing a safety limit switch to keep the line running",
    "Working under a hydraulic lift table without the safety bar engaged",
    "Entering a robotic cell without the teach pendant"
  ]
};

export const REALISTIC_ENVIRONMENTS = [
  "Wet and Slippery Production Floor",
  "High-Traffic Forklift Lane",
  "Dimly Lit Raw Meat Cooler",
  "Noisy Grinder and Blender Deck",
  "Steamy Sanitation Washdown Bay",
  "Cluttered Maintenance Workshop",
  "Fast-Paced RTE Packaging Line",
  "Icy and Slick Spiral Freezer",
  "Crowded Palletizing Area",
  "Greasy Continuous Oven Outfeed",
  "Dusty Spice Formulation Room",
  "Slippery Loading Dock Plate",
  "Confined Space Inside a Meat Blender",
  "Narrow Walkway Near Moving Conveyors",
  "Elevated Platform with Wet Grating",
  "Battery Charging Station with Acid Spills",
  "Metal Detection Zone with High Vibration",
  "Combo Dumper Station with Poor Visibility",
  "Chemical Storage Room with Strong Odors",
  "Incline Conveyor with Exposed Pinch Points"
];

export const generateProceduralActions = (category: string, count: number = 20): string[] => {
  const actions = ACTION_TEMPLATES[category];
  if (!actions) return [];
  // Return a shuffled copy using deterministic PRNG
  return prng.shuffle(actions);
};

export const generateProceduralEnvironments = (count: number = 20): string[] => {
  // Return a shuffled copy of the realistic environments using deterministic PRNG
  return prng.shuffle(REALISTIC_ENVIRONMENTS).slice(0, count);
};
