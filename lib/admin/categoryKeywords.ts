import { CategoryKey } from '@/types';

// Ordered, explicit food/style words. Never use generic store suffixes (집/관/루),
// single characters (회/바/소/면), or address/memo text as evidence.
const RULES: { id: string; key: CategoryKey; words: string[] }[] = [
  { id: 'western-style', key: 'West', words: ['경양식', '양식당', '스테이크하우스', '스테이크', '파스타', '스파게티', '리조또', '라자냐', '뇨끼', '피자', '햄버거', '수제버거', '버거', '샌드위치', '브런치', '프렌치레스토랑', '이탈리안', '이탈리아요리', '그리스요리', '스페인요리', '빠에야', '비스트로'] },
  { id: 'chinese-food', key: 'China', words: ['중화요리', '중국요리', '중국집', '중식당', '반점', '짜장', '자장면', '짬뽕', '탕수육', '마라탕', '마라샹궈', '훠궈', '딤섬', '샤오롱바오', '샤오룽바오', '샤오룽빠오', '소룡포', '꿔바로우', '깐풍기', '양장피', '유산슬', '우육면', '탄탄면', '베이징덕', '북경오리', '차이나'] },
  { id: 'asian-world-food', key: 'Asian', words: ['베트남', '쌀국수', '분짜', '반미', '월남쌈', '팟타이', '똠얌', '태국음식', '태국요리', '타이푸드', '인도요리', '인도음식', '인도커리', '탄두리', '네팔요리', '네팔음식', '케밥', '터키요리', '멕시칸', '멕시코', '타코', '브리또', '부리또', '나시고랭', '미고랭', '인도네시아요리', '우즈베키스탄요리', '몽골요리'] },
  { id: 'japanese-food', key: 'Japan', words: ['일식당', '일본요리', '초밥', '스시', '사시미', '라멘', '우동', '소바', '돈카츠', '돈가츠', '돈까스', '돈가스', '규카츠', '카츠동', '가츠동', '규동', '오야코동', '텐동', '장어덮밥', '야키토리', '야키니쿠', '오코노미야키', '스키야키', '타코야키', '스프커리', '수프카레'] },
  // Soup/prepared dishes must precede meat/sea ingredient words.
  { id: 'korean-prepared-food', key: 'Korea', words: ['한식당', '한정식', '국밥', '순대국', '순댓국', '순대', '설렁탕', '곰탕', '갈비탕', '육개장', '해장국', '감자탕', '감자국', '추어탕', '닭곰탕', '닭한마리', '삼계탕', '백숙', '찜닭', '옻닭', '닭볶음탕', '오리탕', '염소탕', '김치찌개', '된장찌개', '부대찌개', '청국장', '강된장', '순두부', '두부', '비빔밥', '쌈밥', '보리밥', '돌솥밥', '쌀밥', '더덕밥', '산채', '헛제사밥', '냉면', '밀면', '막국수', '칼국수', '콩국수', '잔치국수', '고기국수', '수제비', '옹심이', '보쌈', '족발', '빈대떡', '파전', '부침개', '감자적', '팥죽', '호박죽', '선지국', '묵집'] },
  { id: 'snack-chicken', key: 'Snack', words: ['분식', '김밥', '떡볶이', '라볶이', '쫄면', '만두', '찐빵', '핫도그', '김말이', '닭강정', '통닭', '치킨'] },
  { id: 'seafood', key: 'Sea', words: ['횟집', '회센터', '회식당', '활어', '해산물', '해물', '수산', '생선구이', '장어', '꼼장어', '곰장어', '아구', '아귀', '복어', '복집', '복식당', '복터진', '물텀벙', '게장', '꽃게', '대게', '홍게', '킹크랩', '랍스터', '조개', '굴구이', '굴찜', '굴밥', '석화', '전복', '오징어', '쭈꾸미', '주꾸미', '낙지', '문어', '새우', '재첩', '다슬기', '짱뚱어', '매운탕', '대구탕', '동태탕', '황태구이', '북어국', '어죽'] },
  { id: 'grilled-meat', key: 'Meat', words: ['고깃집', '고기집', '고기구이', '고기전문', '한우', '생고기', '소고기', '쇠고기', '돼지고기', '삼겹', '목살', '항정살', '갈비', '육회', '육사시미', '차돌', '양꼬치', '양갈비', '양다리', '양고기', '곱창', '막창', '대창', '대패', '갈매기살', '화로구이', '연탄구이', '숯불구이', '불고기', '주물럭', '흑돼지', '식육식당', '정육식당', '뒷고기', '오리구이', '오리로스', '오리불고기', '바베큐', '바비큐'] },
  { id: 'cafe-dessert', key: 'Cafe', words: ['카페', '커피', '베이커리', '제빵', '제과', '빵집', '도넛', '도너츠', '케이크', '케익', '디저트', '마카롱', '쿠키', '빙수', '아이스크림', '젤라또', '와플', '크레페', '떡집', '떡방'] },
  { id: 'pub', key: 'Beer', words: ['술집', '주점', '호프', '맥주', '비어', '포차', '이자카야', '와인바', '칵테일', '막걸리', '선술집', '브루어리', '펍'] },
];
const ENGLISH: { key: CategoryKey; pattern: RegExp }[] = [
  { key: 'West', pattern: /\b(pizza|burger|pasta|steak|bistro|sandwich|brunch)\b/i },
  { key: 'China', pattern: /\b(chinese|dim\s*sum|hotpot)\b/i },
  { key: 'Asian', pattern: /\b(vietnamese|thai|indian|kebab|taco|burrito)\b/i },
  { key: 'Japan', pattern: /\b(sushi|ramen|udon|soba|tonkatsu|yakitori)\b/i },
  { key: 'Sea', pattern: /\b(seafood|oyster|lobster)\b/i },
  { key: 'Meat', pattern: /\b(bbq|barbecue)\b/i },
  { key: 'Snack', pattern: /\b(fried\s+chicken)\b/i },
  { key: 'Cafe', pattern: /\b(caf[eé]|coffee|bakery|dessert|gelato)\b/i },
  { key: 'Beer', pattern: /\b(pub|bar|beer|brewery|cocktail)\b/i },
];

export function classifyFoodKeywords(text: string): { key: CategoryKey; keyword: string; rule: string } | undefined {
  const compact = text.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
  // A butcher shop is a store, whereas 식육식당/정육식당 is a restaurant.
  if (/정육점|식육점/.test(compact) && !/정육식당|식육식당/.test(compact)) return { key: 'Other', keyword: compact.includes('정육점') ? '정육점' : '식육점', rule: 'butcher-shop' };
  for (const rule of RULES) {
    const keyword = rule.words.find(word => {
      if (!compact.includes(word)) return false;
      // 한일식당/천일식당/산중식당/신한양식당 are store names, not cuisine labels.
      if (['한식당','중식당','일식당','양식당'].includes(word)) return new RegExp(`(?:^|[^\\p{L}\\p{N}])${word}(?=$|[^\\p{L}\\p{N}])`, 'u').test(text);
      if (word === '초밥' && compact.includes('초밥상')) return false;
      if (['복집','복식당'].includes(word) && compact.includes(`행${word}`)) return false;
      return true;
    });
    if (keyword) return { key: rule.key, keyword, rule: rule.id };
  }
  for (const rule of ENGLISH) {
    const match = text.match(rule.pattern);
    if (match) return { key: rule.key, keyword: match[0], rule: 'english-food' };
  }
}

export const KEYWORD_RULE_COUNT = RULES.reduce((n, rule) => n + rule.words.length, 0) + ENGLISH.length;
