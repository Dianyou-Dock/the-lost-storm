import zh from './zh.json' with { type: 'json' };
import curated from './curated.json' with { type: 'json' };

type Dictionary = Readonly<Record<string, string>>;

const dictionary: Dictionary = zh;
const curatedNames: Dictionary = curated;
const attributes: readonly string[] = ['aria-label', 'aria-description', 'placeholder'];
const terminology: readonly (readonly [string, string])[] = [
  ['库存', '背包'],
  ['烧瓶', '药剂'],
  ['字符', '角色'],
  ['梯子', '天梯'],
  ['损坏', '伤害'],
  ['争吵', '弩矢'],
  ['螺栓', '弩矢'],
  ['道奇', '闪避'],
  ['航路点', '传送点'],
  ['路径点', '传送点'],
  ['接机', '拾取'],
];
const overrides: Dictionary = {
  'A name, then who wakes': '取个名字，再选择角色',
  'Alt': 'Alt',
  'AltLeft': 'AltLeft',
  'AltRight': 'AltRight',
  'Characters': '角色列表',
  'Clear a moment': '清除一处异变',
  'Critical Chance': '暴击率',
  'Critical chance': '暴击率',
  'Damage': '伤害',
  'Damage per second': '每秒伤害',
  'Drop?': '丢弃？',
  'Close Inventory': '关闭背包',
  'Charm': '护符',
  'Biggest hit': '最高单次伤害',
  'Gold looted': '获得金币',
  'Critical multiplier': '暴击伤害倍率',
  'Storm resistance': '风暴抗性',
  'Freeze resistance': '冰冻抗性',
  'Deaths': '死亡次数',
  'Moments cleared': '已清除异变',
  'No points yet. Moments in the storm and each new level bring them.': '尚无天赋点。清除异变或升级可获得。',
  'points': '点可用',
  'point': '点可用',
  'The Gathering Storm': '风暴聚集',
  'The Turning Tide': '潮汐逆转',
  'The Long Shadow': '漫长暗影',
  'The Banked Fire': '蓄火',
  'The Echo': '回响',
  'free': '免费',
  'Delete character': '删除角色',
  'Discord': 'Discord',
  'Flasks': '药剂',
  'Stash': '仓库',
  'Your bag': '你的背包',
  'Dodge Roll': '闪避翻滚',
  'Unverified': '未认证',
  'Story items cannot be traded': '剧情物品不能交易',
  'Only items in the ledger can be traded': '仅认证装备可交易',
  'Open the skill tree from the top bar to choose a place': '点击顶部天赋按钮选择节点',
  'Open the skill tree with T to choose a place': '按 T 打开天赋图选择节点',
  'Inventory is full': '背包已满',
  'Ladder': '天梯',
  'Life flask': '生命药剂',
  'Lobby': '角色选择',
  'Mana flask': '法力药剂',
  'No damage': '无伤害',
  'Armour': '护甲',
  'Offline. The ladder needs a connection; your character is kept on this device.': '离线模式无法使用天梯；角色保存在本机。',
  'Quest': '任务',
  'Quests done': '已完成任务',
  'Space': 'Space',
  'Storm damage': '风暴伤害',
  'Tab': 'Tab',
  'The First Moment': '初始异变',
  'Waypoint': '传送点',
  'Waypoint found': '已发现传送点',
  'Waypoint not yet found': '尚未发现传送点',
  'Weapon damage': '武器伤害',
  'Your character': '你的角色',
  'Zoom': '缩放',
};

function phrase(value: string): string {
  const override: string | undefined = overrides[value];
  if (override !== undefined) return override;
  const curatedName: string | undefined = curatedNames[value];
  if (curatedName !== undefined) return curatedName;
  const direct: string | undefined = dictionary[value];
  if (direct !== undefined) return direct;
  const level: RegExpMatchArray | null = /^Level (\d+)$/.exec(value);
  if (level !== null) return `等级 ${level[1]}`;
  const uses: RegExpMatchArray | null = /^(.*), (\d+) of (\d+) uses$/.exec(value);
  if (uses !== null) return `${phrase(uses[1] ?? '')}，剩余 ${uses[2]}/${uses[3]} 次`;
  const played: RegExpMatchArray | null = /^Played (\d+) min$/.exec(value);
  if (played !== null) return `已游玩 ${played[1]} 分钟`;
  const playedHours: RegExpMatchArray | null = /^Played (\d+) h$/.exec(value);
  if (playedHours !== null) return `已游玩 ${playedHours[1]} 小时`;
  const bag: RegExpMatchArray | null = /^Your bag: (.+)$/.exec(value);
  if (bag !== null) return `你的背包：${phrase(bag[1] ?? '')}`;
  const lastSeen: RegExpMatchArray | null = /^Last seen in (.+)$/.exec(value);
  if (lastSeen !== null) return `上次位于${phrase(lastSeen[1] ?? '')}`;
  const points: RegExpMatchArray | null = /^(\d+) points$/.exec(value);
  if (points !== null) return `${points[1]} 点可用`;
  const stat: RegExpMatchArray | null = /^([+-]\d+(?:\.\d+)?%?) (.+)$/.exec(value);
  if (stat !== null) return `${stat[1]} ${phrase(stat[2] ?? '')}`;
  if (value.includes(' · ')) return value.split(' · ').map(phrase).join(' · ');
  return value;
}

export function localizeText(value: string): string {
  const trimmed: string = value.trim();
  if (trimmed.length === 0) return value;
  const result: string = phrase(trimmed);
  if (result === trimmed) return value;
  let cleaned: string = result;
  for (const [from, to] of terminology) cleaned = cleaned.replaceAll(from, to);
  const leading: string = /^\s*/.exec(value)?.[0] ?? '';
  const trailing: string = /\s*$/.exec(value)?.[0] ?? '';
  return `${leading}${cleaned}${trailing}`;
}

function textNode(node: Text): void {
  const parent: Element | null = node.parentElement;
  if (parent === null || parent.closest('script, style, code, pre') !== null) return;
  const result: string = localizeText(node.data);
  if (result !== node.data) node.data = result;
}

function element(node: Element): void {
  for (const name of attributes) {
    const value: string | null = node.getAttribute(name);
    if (value === null) continue;
    const result: string = localizeText(value);
    if (result !== value) node.setAttribute(name, result);
  }
}

function subtree(node: Node): void {
  if (node instanceof Text) {
    textNode(node);
    return;
  }
  if (!(node instanceof Element)) return;
  element(node);
  const walker: TreeWalker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const current: Node = walker.currentNode;
    if (current instanceof Text) textNode(current);
    else if (current instanceof Element) element(current);
  }
}

export function startLocalization(): void {
  document.documentElement.lang = 'zh-CN';
  document.title = '摸鱼游戏';
  const root: HTMLElement = document.body;
  subtree(root);
  const observer: MutationObserver = new MutationObserver((records: MutationRecord[]): void => {
    for (const record of records) {
      if (record.type === 'characterData') {
        if (record.target instanceof Text) textNode(record.target);
      } else if (record.type === 'attributes') {
        if (record.target instanceof Element) element(record.target);
      } else {
        for (const node of record.addedNodes) subtree(node);
      }
    }
  });
  observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...attributes] });
}
