// 兩個身分。id 是存進資料庫的值，不要改。
export const ROLES = {
  maimai: { id: 'maimai', name: '麥麥' },
  xiaobao: { id: 'xiaobao', name: '小寶' },
};

export const partnerOf = (id) => (id === 'maimai' ? 'xiaobao' : 'maimai');

// 「我是誰」存在這支手機上（不上傳）
export const loadRole = () => {
  const id = localStorage.getItem('role');
  return ROLES[id] ? id : null;
};
export const saveRole = (id) => localStorage.setItem('role', id);
