import type { HomeProject, Opening, Room, Wall } from '../domain/types';
import { tracePoint as p } from './referenceAlignment';

/** Photo-relative floor plan. No length here claims to be a measured dimension. */
export function tracedGeometry(): Pick<HomeProject, 'rooms' | 'walls' | 'openings'> {
  const room = (id: string, name: string, kind: Room['kind'], xy: number[][]): Room => ({ id, name, kind, polygon: xy.map(([x, y]) => p(x, y)) });
  const rooms = [
    room('entry', '玄關', 'hall', [[198, 542], [422, 542], [422, 695], [198, 695]]),
    room('kitchen', '廚房', 'kitchen', [[422, 425], [730, 425], [730, 605], [422, 605]]),
    room('work-balcony', '工作陽台', 'balcony', [[730, 455], [1082, 455], [1082, 605], [730, 605]]),
    room('dining', '餐廳', 'living', [[422, 605], [690, 605], [690, 910], [422, 910], [422, 695]]),
    room('guest-bath', '客浴', 'bath', [[690, 605], [815, 605], [815, 825], [690, 825]]),
    room('secondary-bath', '次主浴', 'bath', [[815, 605], [940, 605], [940, 825], [815, 825]]),
    room('bedroom-one', '臥室一', 'bedroom', [[940, 605], [1197, 605], [1197, 825], [940, 825]]),
    room('hall', '走道', 'hall', [[690, 825], [1015, 825], [1015, 910], [825, 910], [690, 910]]),
    room('living', '客廳', 'living', [[422, 910], [825, 910], [825, 1189], [422, 1183]]),
    room('bedroom-two', '臥室二', 'bedroom', [[825, 910], [1015, 910], [1015, 1192], [825, 1189]]),
    room('master', '主臥室', 'bedroom', [[1015, 825], [1197, 825], [1265, 825], [1265, 1196], [1015, 1192], [1015, 910]]),
    room('master-bath', '主浴', 'bath', [[1265, 825], [1430, 825], [1430, 1200], [1265, 1196]]),
    room('front-balcony', '陽台', 'balcony', [[480, 1184], [685, 1187], [685, 1270], [480, 1300]]),
  ];
  const wall = (id: string, a: number[], b: number[], thickness = 0.14): Wall => ({ id, a: p(a[0], a[1]), b: p(b[0], b[1]), thickness });
  const walls = [
    wall('entry-west', [198, 542], [198, 695], 0.2), wall('entry-north', [198, 542], [422, 542], 0.2),
    wall('entry-south', [198, 695], [422, 695], 0.2), wall('kitchen-west', [422, 425], [422, 542], 0.2),
    wall('kitchen-north', [422, 425], [730, 425], 0.2), wall('kitchen-step', [730, 425], [730, 455], 0.2),
    wall('work-north', [730, 455], [1082, 455], 0.2), wall('work-east', [1082, 455], [1082, 605], 0.2),
    wall('kitchen-work', [730, 455], [730, 605]), wall('kitchen-south', [422, 605], [690, 605]),
    wall('baths-north', [690, 605], [940, 605]), wall('bedroom-one-north', [940, 605], [1197, 605], 0.2),
    wall('bedroom-one-east', [1197, 605], [1197, 825], 0.2), wall('guest-bath-west', [690, 605], [690, 825]),
    wall('baths-divider', [815, 605], [815, 825]), wall('secondary-bath-east', [940, 605], [940, 825]),
    wall('guest-bath-south', [690, 825], [815, 825]), wall('secondary-bath-south', [815, 825], [940, 825]),
    wall('bedroom-one-south', [940, 825], [1197, 825]), wall('living-west', [422, 695], [422, 1183], 0.2),
    wall('bedroom-two-north', [825, 910], [1015, 910]), wall('bedroom-two-west', [825, 910], [825, 1189]),
    wall('bedrooms-divider', [1015, 910], [1015, 1192]),
    // The master entrance is in this SHORT VERTICAL wall, not across the room.
    wall('master-entry-west', [1015, 825], [1015, 910]),
    wall('master-north', [1197, 825], [1265, 825], 0.2),
    wall('master-bath-west', [1265, 825], [1265, 1196]), wall('master-bath-north', [1265, 825], [1430, 825], 0.2),
    wall('master-bath-east', [1430, 825], [1430, 1200], 0.2),
    wall('living-south-left', [422, 1183], [480, 1184], 0.2), wall('living-balcony', [480, 1184], [685, 1187], 0.2),
    wall('living-south-right', [685, 1187], [825, 1189], 0.2), wall('bedroom-two-south', [825, 1189], [1015, 1192], 0.2),
    wall('master-south', [1015, 1192], [1265, 1196], 0.2), wall('master-bath-south', [1265, 1196], [1430, 1200], 0.2),
    wall('balcony-west', [480, 1184], [480, 1300]), wall('balcony-south', [480, 1300], [685, 1270]),
    wall('balcony-east', [685, 1187], [685, 1270]),
  ];
  const opening = (id: string, wallId: string, start: number, end: number, kind: Opening['kind'] = 'door', height = 2.1, sill = 0): Opening => {
    const parent = walls.find(w => w.id === wallId)!;
    const length = Math.hypot(parent.b.x - parent.a.x, parent.b.y - parent.a.y);
    return { id, wallId, kind, offset: start * length, width: (end - start) * length, height, sill };
  };
  const openings = [
    opening('front-door', 'entry-west', .42, .94), opening('kitchen-door', 'kitchen-south', .25, .55),
    opening('work-door', 'kitchen-work', .2, .68), opening('guest-bath-door', 'guest-bath-south', .04, .55),
    opening('secondary-bath-door', 'secondary-bath-east', .7, .97),
    opening('bedroom-one-door', 'bedroom-one-south', .025, .255), opening('bedroom-two-door', 'bedroom-two-north', .035, .38),
    opening('master-door', 'master-entry-west', .07, .94), opening('master-bath-door', 'master-bath-west', .21, .4),
    opening('balcony-door', 'living-balcony', .06, .96, 'door', 2.2),
    opening('guest-bath-window', 'baths-north', .12, .3, 'window', .85, 1.3),
    opening('secondary-bath-window', 'baths-north', .63, .82, 'window', .85, 1.3),
    opening('bedroom-one-window', 'bedroom-one-east', .22, .9, 'window', 1.5, .7),
    opening('living-window', 'living-south-right', .1, .85, 'window', 1.5, .7),
    opening('bedroom-two-window', 'bedroom-two-south', .2, .85, 'window', 1.5, .7),
    opening('master-window', 'master-south', .2, .84, 'window', 1.5, .7),
    opening('master-bath-window', 'master-bath-south', .12, .9, 'window', 1.1, 1.1),
  ];
  return { rooms, walls, openings };
}
