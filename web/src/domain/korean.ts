/** 받침 유무에 따라 조사를 붙인다: josa('민수', '이', '가') → '민수가', josa('지은', '이', '가') → '지은이' */
export function josa(word: string, withFinal: string, withoutFinal: string): string {
  const last = word.charCodeAt(word.length - 1)
  if (last < 0xac00 || last > 0xd7a3) return word + withoutFinal
  return word + ((last - 0xac00) % 28 !== 0 ? withFinal : withoutFinal)
}
