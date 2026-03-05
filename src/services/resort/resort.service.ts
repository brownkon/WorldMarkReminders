import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { createChildLogger } from '../../utils/logger';

const log = createChildLogger('resort-service');

export interface ResortSeedData {
    name: string;
    brand: 'worldmark' | 'club_wyndham';
    city: string;
    state: string;
    latitude: number;
    longitude: number;
    url: string;
    unitTypes: string[];
}

// Known WorldMark resort locations with approximate coordinates
export const WORLDMARK_RESORTS: ResortSeedData[] = [
    // Arizona
    { name: 'WorldMark Bison Ranch', brand: 'worldmark', city: 'Overgaard', state: 'AZ', latitude: 34.3642, longitude: -110.5415, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/arizona/overgaard/worldmark-bison-ranch', unitTypes: ['Studio', '1BR', '2BR'] },
    { name: 'WorldMark Havasu Dunes', brand: 'worldmark', city: 'Lake Havasu City', state: 'AZ', latitude: 34.4839, longitude: -114.3224, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/arizona/lake-havasu-city/worldmark-havasu-dunes', unitTypes: ['Studio', '1BR', '2BR'] },
    { name: 'WorldMark Phoenix South Mountain Preserve', brand: 'worldmark', city: 'Phoenix', state: 'AZ', latitude: 33.3411, longitude: -112.0483, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/arizona/phoenix/worldmark-phoenix-south-mountain-preserve', unitTypes: ['Studio', '1BR', '2BR'] },
    { name: 'WorldMark Pinetop', brand: 'worldmark', city: 'Pinetop', state: 'AZ', latitude: 34.1318, longitude: -109.9433, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/arizona/pinetop/worldmark-pinetop', unitTypes: ['Studio', '1BR', '2BR'] },
    { name: 'WorldMark Rancho Vistoso', brand: 'worldmark', city: 'Oro Valley', state: 'AZ', latitude: 32.4192, longitude: -110.9664, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/arizona/oro-valley/worldmark-rancho-vistoso', unitTypes: ['1BR', '2BR'] },
    { name: 'WorldMark Scottsdale', brand: 'worldmark', city: 'Scottsdale', state: 'AZ', latitude: 33.4942, longitude: -111.9261, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/arizona/scottsdale/worldmark-scottsdale', unitTypes: ['Studio', '1BR', '2BR'] },
    { name: 'WorldMark Sedona', brand: 'worldmark', city: 'Sedona', state: 'AZ', latitude: 34.8697, longitude: -111.7610, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/arizona/sedona/worldmark-sedona', unitTypes: ['Studio', '1BR', '2BR'] },

    // California
    { name: 'WorldMark Anaheim', brand: 'worldmark', city: 'Anaheim', state: 'CA', latitude: 33.8085, longitude: -117.9228, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/california/anaheim/worldmark-anaheim', unitTypes: ['Studio', '1BR', '2BR'] },
    { name: 'WorldMark Angels Camp', brand: 'worldmark', city: 'Angels Camp', state: 'CA', latitude: 38.0686, longitude: -120.5396, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/california/angels-camp/worldmark-angels-camp', unitTypes: ['1BR', '2BR', '3BR'] },
    { name: 'WorldMark Bass Lake', brand: 'worldmark', city: 'Bass Lake', state: 'CA', latitude: 37.3224, longitude: -119.5717, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/california/bass-lake/worldmark-bass-lake', unitTypes: ['1BR', '2BR', '3BR'] },
    { name: 'WorldMark Big Bear', brand: 'worldmark', city: 'Big Bear Lake', state: 'CA', latitude: 34.2440, longitude: -116.9114, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/california/big-bear-lake/worldmark-big-bear', unitTypes: ['Studio', '1BR', '2BR'] },
    { name: 'WorldMark Cathedral City', brand: 'worldmark', city: 'Cathedral City', state: 'CA', latitude: 33.7792, longitude: -116.4653, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/california/cathedral-city/worldmark-cathedral-city', unitTypes: ['1BR', '2BR'] },
    { name: 'WorldMark Indio', brand: 'worldmark', city: 'Indio', state: 'CA', latitude: 33.7207, longitude: -116.2156, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/california/indio/worldmark-indio', unitTypes: ['1BR', '2BR', '3BR'] },
    { name: 'WorldMark Marina Dunes', brand: 'worldmark', city: 'Marina', state: 'CA', latitude: 36.6849, longitude: -121.8016, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/california/marina/worldmark-marina-dunes', unitTypes: ['1BR', '2BR'] },
    { name: 'WorldMark Oceanside', brand: 'worldmark', city: 'Oceanside', state: 'CA', latitude: 33.1959, longitude: -117.3795, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/california/oceanside/worldmark-oceanside-harbor', unitTypes: ['Studio', '1BR', '2BR'] },
    { name: 'WorldMark Palm Springs', brand: 'worldmark', city: 'Palm Springs', state: 'CA', latitude: 33.8303, longitude: -116.5453, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/california/palm-springs/worldmark-palm-springs', unitTypes: ['Studio', '1BR', '2BR'] },
    { name: 'WorldMark Pismo Beach', brand: 'worldmark', city: 'Pismo Beach', state: 'CA', latitude: 35.1428, longitude: -120.6413, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/california/pismo-beach/worldmark-pismo-beach', unitTypes: ['Studio', '1BR', '2BR'] },
    { name: 'WorldMark San Diego Balboa Park', brand: 'worldmark', city: 'San Diego', state: 'CA', latitude: 32.7311, longitude: -117.1501, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/california/san-diego/worldmark-san-diego-balboa-park', unitTypes: ['Studio', '1BR', '2BR'] },
    { name: 'WorldMark San Diego Mission Valley', brand: 'worldmark', city: 'San Diego', state: 'CA', latitude: 32.7682, longitude: -117.1560, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/california/san-diego/worldmark-san-diego-mission-valley', unitTypes: ['Studio', '1BR'] },
    { name: 'WorldMark Windsor', brand: 'worldmark', city: 'Windsor', state: 'CA', latitude: 38.5471, longitude: -122.8166, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/california/windsor/worldmark-windsor', unitTypes: ['1BR', '2BR', '3BR'] },
    { name: 'WorldMark Discovery Bay', brand: 'worldmark', city: 'Discovery Bay', state: 'CA', latitude: 37.9087, longitude: -121.6008, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/california/discovery-bay/worldmark-discovery-bay', unitTypes: ['2BR'] },

    // Colorado
    { name: 'WorldMark Steamboat Springs', brand: 'worldmark', city: 'Steamboat Springs', state: 'CO', latitude: 40.4850, longitude: -106.8317, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/colorado/steamboat-springs/worldmark-steamboat-springs', unitTypes: ['Studio', '1BR', '2BR'] },
    { name: 'WorldMark Estes Park', brand: 'worldmark', city: 'Estes Park', state: 'CO', latitude: 40.3772, longitude: -105.5217, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/colorado/estes-park/worldmark-estes-park', unitTypes: ['Studio', '1BR'] },

    // Florida
    { name: 'WorldMark Orlando Kingstown Reef', brand: 'worldmark', city: 'Orlando', state: 'FL', latitude: 28.3604, longitude: -81.5085, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/florida/orlando/worldmark-orlando-kingstown-reef', unitTypes: ['1BR', '2BR', '3BR'] },

    // Hawaii
    { name: 'WorldMark Kona', brand: 'worldmark', city: 'Kailua-Kona', state: 'HI', latitude: 19.6400, longitude: -155.9969, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/hawaii/kailua-kona/worldmark-kona', unitTypes: ['1BR', '2BR'] },
    { name: 'WorldMark Kapaa Shore', brand: 'worldmark', city: 'Kapaa', state: 'HI', latitude: 22.0881, longitude: -159.3390, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/hawaii/kapaa/worldmark-kapaa-shore', unitTypes: ['1BR', '2BR'] },
    { name: 'WorldMark Valley Isle', brand: 'worldmark', city: 'Lahaina', state: 'HI', latitude: 20.8783, longitude: -156.6825, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/hawaii/lahaina/worldmark-valley-isle', unitTypes: ['1BR', '2BR'] },

    // Idaho
    { name: 'WorldMark Arrow Point', brand: 'worldmark', city: 'Coeur d\'Alene', state: 'ID', latitude: 47.7040, longitude: -116.7830, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/idaho/coeur-d-alene/worldmark-arrow-point', unitTypes: ['1BR', '2BR'] },
    { name: 'WorldMark McCall', brand: 'worldmark', city: 'McCall', state: 'ID', latitude: 44.7335, longitude: -116.0986, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/idaho/mccall/worldmark-mccall', unitTypes: ['1BR', '2BR'] },

    // Missouri
    { name: 'WorldMark Branson', brand: 'worldmark', city: 'Branson', state: 'MO', latitude: 36.6437, longitude: -93.2185, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/missouri/branson/worldmark-branson', unitTypes: ['1BR', '2BR', '3BR'] },

    // Montana
    { name: 'WorldMark West Yellowstone', brand: 'worldmark', city: 'West Yellowstone', state: 'MT', latitude: 44.6621, longitude: -111.1041, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/montana/west-yellowstone/worldmark-west-yellowstone', unitTypes: ['1BR', '2BR'] },

    // Nevada
    { name: 'WorldMark Las Vegas Boulevard', brand: 'worldmark', city: 'Las Vegas', state: 'NV', latitude: 36.1147, longitude: -115.1728, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/nevada/las-vegas/worldmark-las-vegas-boulevard', unitTypes: ['Studio', '1BR', '2BR'] },
    { name: 'WorldMark Las Vegas Spencer Street', brand: 'worldmark', city: 'Las Vegas', state: 'NV', latitude: 36.1082, longitude: -115.1456, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/nevada/las-vegas/worldmark-las-vegas-spencer-street', unitTypes: ['Studio', '1BR'] },
    { name: 'WorldMark Las Vegas Tropicana', brand: 'worldmark', city: 'Las Vegas', state: 'NV', latitude: 36.0983, longitude: -115.1718, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/nevada/las-vegas/worldmark-las-vegas-tropicana', unitTypes: ['Studio', '1BR', '2BR'] },
    { name: 'WorldMark Reno', brand: 'worldmark', city: 'Reno', state: 'NV', latitude: 39.5296, longitude: -119.8138, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/nevada/reno/worldmark-reno', unitTypes: ['1BR', '2BR'] },

    // New Mexico
    { name: 'WorldMark Taos', brand: 'worldmark', city: 'Taos', state: 'NM', latitude: 36.3960, longitude: -105.5746, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/new-mexico/taos/worldmark-taos', unitTypes: ['1BR', '2BR'] },
    { name: 'WorldMark Angel Fire', brand: 'worldmark', city: 'Angel Fire', state: 'NM', latitude: 36.3930, longitude: -105.2853, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/new-mexico/angel-fire/worldmark-angel-fire', unitTypes: ['1BR', '2BR'] },

    // Oregon
    { name: 'WorldMark Bend Seventh Mountain', brand: 'worldmark', city: 'Bend', state: 'OR', latitude: 43.9952, longitude: -121.4985, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/oregon/bend/worldmark-bend-seventh-mountain', unitTypes: ['Studio', '1BR', '2BR'] },
    { name: 'WorldMark Depoe Bay', brand: 'worldmark', city: 'Depoe Bay', state: 'OR', latitude: 44.8084, longitude: -124.0619, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/oregon/depoe-bay/worldmark-depoe-bay', unitTypes: ['Studio', '1BR', '2BR'] },
    { name: 'WorldMark Eagle Crest', brand: 'worldmark', city: 'Redmond', state: 'OR', latitude: 44.2735, longitude: -121.1818, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/oregon/redmond/worldmark-eagle-crest', unitTypes: ['1BR', '2BR'] },
    { name: 'WorldMark Gleneden Beach', brand: 'worldmark', city: 'Gleneden Beach', state: 'OR', latitude: 44.8760, longitude: -124.0350, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/oregon/gleneden-beach/worldmark-gleneden-beach', unitTypes: ['Studio', '2BR'] },
    { name: 'WorldMark Portland', brand: 'worldmark', city: 'Portland', state: 'OR', latitude: 45.5152, longitude: -122.6784, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/oregon/portland/worldmark-portland', unitTypes: ['Studio', '1BR'] },
    { name: 'WorldMark Seaside', brand: 'worldmark', city: 'Seaside', state: 'OR', latitude: 45.9932, longitude: -123.9226, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/oregon/seaside/worldmark-seaside', unitTypes: ['Studio', '1BR', '2BR'] },

    // Texas
    { name: 'WorldMark New Braunfels', brand: 'worldmark', city: 'New Braunfels', state: 'TX', latitude: 29.7030, longitude: -98.1245, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/texas/new-braunfels/worldmark-new-braunfels', unitTypes: ['1BR', '2BR', '3BR'] },
    { name: 'WorldMark Marble Falls', brand: 'worldmark', city: 'Marble Falls', state: 'TX', latitude: 30.5783, longitude: -98.2738, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/texas/marble-falls/worldmark-marble-falls', unitTypes: ['1BR', '2BR'] },
    { name: 'WorldMark Austin', brand: 'worldmark', city: 'Austin', state: 'TX', latitude: 30.2672, longitude: -97.7431, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/texas/austin/worldmark-austin', unitTypes: ['Studio', '1BR', '2BR'] },

    // Utah
    { name: 'WorldMark St. George', brand: 'worldmark', city: 'St. George', state: 'UT', latitude: 37.0965, longitude: -113.5684, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/utah/st-george/worldmark-st-george', unitTypes: ['1BR', '2BR'] },
    { name: 'WorldMark Wolf Creek', brand: 'worldmark', city: 'Eden', state: 'UT', latitude: 41.3138, longitude: -111.8542, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/utah/eden/worldmark-wolf-creek', unitTypes: ['1BR', '2BR', '3BR'] },
    { name: 'WorldMark Bear Lake', brand: 'worldmark', city: 'Garden City', state: 'UT', latitude: 41.9360, longitude: -111.3975, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/utah/garden-city/worldmark-bear-lake', unitTypes: ['1BR', '2BR'] },
    { name: 'WorldMark Park City', brand: 'worldmark', city: 'Park City', state: 'UT', latitude: 40.6461, longitude: -111.4980, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/utah/park-city/worldmark-park-city', unitTypes: ['1BR', '2BR'] },

    // Washington
    { name: 'WorldMark Birch Bay', brand: 'worldmark', city: 'Birch Bay', state: 'WA', latitude: 48.9214, longitude: -122.7637, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/washington/birch-bay/worldmark-birch-bay', unitTypes: ['Studio', '1BR', '2BR'] },
    { name: 'WorldMark Long Beach', brand: 'worldmark', city: 'Long Beach', state: 'WA', latitude: 46.3524, longitude: -124.0543, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/washington/long-beach/worldmark-long-beach', unitTypes: ['Studio', '1BR', '2BR'] },
    { name: 'WorldMark Leavenworth', brand: 'worldmark', city: 'Leavenworth', state: 'WA', latitude: 47.5962, longitude: -120.6614, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/washington/leavenworth/worldmark-leavenworth', unitTypes: ['Studio', '1BR', '2BR'] },

    // International
    { name: 'WorldMark Fiji Denarau Island', brand: 'worldmark', city: 'Denarau Island', state: 'Western', latitude: -17.7726, longitude: 177.3733, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/fiji/worldmark-fiji-denarau-island', unitTypes: ['1BR', '2BR'] },
    { name: 'WorldMark San Jose del Cabo', brand: 'worldmark', city: 'San José del Cabo', state: 'BCS', latitude: 23.0608, longitude: -109.6988, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/mexico/worldmark-san-jose-del-cabo', unitTypes: ['1BR', '2BR'] },
    { name: 'WorldMark Canmore Banff', brand: 'worldmark', city: 'Canmore', state: 'AB', latitude: 51.0884, longitude: -115.3479, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/canada/worldmark-canmore-banff', unitTypes: ['1BR', '2BR'] },
    { name: 'WorldMark Victoria', brand: 'worldmark', city: 'Victoria', state: 'BC', latitude: 48.4284, longitude: -123.3656, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/canada/worldmark-victoria', unitTypes: ['Studio', '1BR'] },

    // Illinois
    { name: 'WorldMark Galena', brand: 'worldmark', city: 'Galena', state: 'IL', latitude: 42.4167, longitude: -90.4290, url: 'https://worldmark.wyndhamdestinations.com/us/en/resorts/united-states/illinois/galena/worldmark-galena', unitTypes: ['1BR', '2BR', '3BR'] },
];

export class ResortService {
    constructor(private db: Database.Database) { }

    seedResorts(): number {
        const insert = this.db.prepare(`
      INSERT OR REPLACE INTO resorts (id, name, brand, address, city, state, latitude, longitude, url, unit_types, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

        const insertMany = this.db.transaction((resorts: ResortSeedData[]) => {
            let count = 0;
            for (const resort of resorts) {
                const existing = this.db.prepare('SELECT id FROM resorts WHERE name = ?').get(resort.name) as { id: string } | undefined;
                const id = existing?.id || uuidv4();

                insert.run(
                    id,
                    resort.name,
                    resort.brand,
                    '', // address - can be enriched later
                    resort.city,
                    resort.state,
                    resort.latitude,
                    resort.longitude,
                    resort.url,
                    JSON.stringify(resort.unitTypes),
                );
                count++;
            }
            return count;
        });

        const count = insertMany(WORLDMARK_RESORTS);
        log.info({ count }, 'Seeded resorts');
        return count;
    }

    getAllResorts(): ResortRow[] {
        return this.db.prepare('SELECT * FROM resorts ORDER BY state, city').all() as ResortRow[];
    }

    getResortById(id: string): ResortRow | undefined {
        return this.db.prepare('SELECT * FROM resorts WHERE id = ?').get(id) as ResortRow | undefined;
    }

    getResortsByBrand(brand: 'worldmark' | 'club_wyndham'): ResortRow[] {
        return this.db.prepare('SELECT * FROM resorts WHERE brand = ? ORDER BY state, city').all(brand) as ResortRow[];
    }

    getResortCount(): number {
        const row = this.db.prepare('SELECT COUNT(*) as count FROM resorts').get() as { count: number };
        return row.count;
    }
}

export interface ResortRow {
    id: string;
    name: string;
    brand: string;
    address: string;
    city: string;
    state: string;
    latitude: number;
    longitude: number;
    url: string;
    unit_types: string;
    created_at: string;
    updated_at: string;
}
