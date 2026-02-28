# FreiCowork 학습 노트

이 프로젝트는 리액트와 타입스크립트 학습을 위해 자세한 주석이 추가된 Electron 기반 AI 개발 도구입니다.

## 📚 학습 주제별 가이드

### 1. TypeScript 기초

#### 타입 정의 (`src/types.d.ts`)
- **Interface**: 객체 구조 정의
- **Union 타입**: `type A = B | C | D` - 여러 타입 중 하나
- **Literal 타입**: `type: 'image'` - 특정 값만 허용
- **제네릭**: `Promise<T>`, `Array<T>` - 재사용 가능한 타입
- **Optional 속성**: `path?: string` - 선택적 속성

#### 유틸리티 타입 (Redux Slices)
- **`ReturnType<T>`**: 함수의 반환 타입 추출
- **`Omit<T, K>`**: T에서 K 속성 제외
- **`Record<K, V>`**: K를 키, V를 값으로 하는 객체
- **`PayloadAction<T>`**: Redux Toolkit의 액션 타입

### 2. React 핵심 개념

#### 컴포넌트 작성 (`src/App.tsx`, `src/components/*.tsx`)
```typescript
// Function Component
const MyComponent: React.FC = () => {
  return <div>Hello</div>;
};
```

#### Hooks (`src/components/ChatPanel.tsx` 참조)

**useState** - 상태 관리
```typescript
const [value, setValue] = useState('초기값');
```

**useEffect** - 부수 효과 처리
```typescript
useEffect(() => {
  // 실행할 코드
  return () => {
    // cleanup 함수
  };
}, [dependencies]); // 의존성 배열
```

**useRef** - DOM 참조 / 렌더링 간 값 유지
```typescript
const ref = useRef<HTMLDivElement>(null);
// JSX: <div ref={ref}>
```

**useCallback** - 함수 메모이제이션
```typescript
const memoizedFn = useCallback(() => {
  // 함수 로직
}, [dependencies]);
```

#### JSX 문법
- **단일 루트 요소**: 하나의 부모로 감싸기
- **중괄호**: `{변수}` - JavaScript 표현식 삽입
- **className**: `class` 대신 사용 (JS 예약어)
- **카멜케이스**: `onClick`, `onChange` 등

### 3. Redux Toolkit

#### 스토어 구조 (`src/store/index.ts`)
```typescript
const store = configureStore({
  reducer: {
    chat: chatReducer,
    file: fileReducer,
    // ...
  },
});
```

#### Slice 생성 패턴 (`src/store/*Slice.ts`)
```typescript
const slice = createSlice({
  name: 'sliceName',
  initialState,
  reducers: {
    actionName(state, action: PayloadAction<Type>) {
      // state 변경 (Immer가 자동 처리)
    },
  },
});
```

#### Redux Hooks 사용
```typescript
// 상태 가져오기
const value = useAppSelector((state) => state.chat.messages);

// 액션 발생시키기
const dispatch = useAppDispatch();
dispatch(setInput('새 값'));
```

### 4. JavaScript/TypeScript 문법

#### 비동기 처리
```typescript
// async/await
async function fetchData() {
  const result = await api.call();
  return result;
}

// Promise
promise.then(result => {}).catch(error => {});
```

#### 배열 메서드
- **map**: 각 요소 변환 `arr.map(x => x * 2)`
- **filter**: 조건 만족하는 요소만 `arr.filter(x => x > 0)`
- **find**: 첫 번째 일치 요소 `arr.find(x => x.id === 1)`
- **push**: 끝에 추가 `arr.push(item)`
- **pop**: 끝에서 제거 `arr.pop()`

#### 구조 분해 할당
```typescript
const { a, b } = { a: 1, b: 2 };
const [x, y] = [1, 2];
```

#### Spread 연산자
```typescript
const newObj = { ...oldObj, key: 'value' };
const newArr = [...arr1, ...arr2];
```

#### 옵셔널 체이닝
```typescript
obj?.method()  // obj가 null이면 undefined 반환
```

#### 단축 평가
```typescript
condition && doSomething()  // condition이 true면 실행
value || defaultValue       // value가 falsy면 defaultValue
```

### 5. 프로젝트별 핵심 패턴

#### Electron IPC 통신 (`src/types.d.ts`)
```typescript
// Renderer → Main
window.api.chat.send(message);

// Main → Renderer (이벤트)
window.api.chat.onStreamChunk((chunk) => {
  // 처리
});
```

#### 파일 첨부 처리 (`src/components/ChatPanel.tsx`)
1. 파일 선택 (`FileExplorer`)
2. 파일 읽기 (`readFileForAI`)
3. 타입별 처리 (이미지/텍스트)
4. AI에게 전송

#### 세션 관리 (`src/store/sessionSlice.ts`)
1. localStorage에 저장
2. 세션 전환 시 상태 저장/복원
3. 각 세션의 독립적인 채팅/작업 관리

## 🎯 학습 추천 순서

1. **TypeScript 기초** → `src/types.d.ts`
2. **Redux 구조** → `src/store/index.ts`, `hooks.ts`
3. **간단한 Slice** → `taskSlice.ts`, `fileSlice.ts`
4. **React 기초** → `App.tsx`, `renderer.tsx`
5. **복잡한 컴포넌트** → `ChatPanel.tsx`, `FileExplorer.tsx`
6. **고급 Slice** → `sessionSlice.ts`, `apiSlice.ts`

## 💡 주요 개념 요약

### Immutability (불변성)
Redux에서는 상태를 직접 수정하지 않고 새 객체를 반환해야 합니다.
Redux Toolkit의 Immer가 이를 자동으로 처리해줍니다.

### Component Lifecycle
1. **Mount**: 컴포넌트 생성
2. **Update**: 상태/props 변경
3. **Unmount**: 컴포넌트 제거

### Controlled Components
React 상태와 입력 필드를 동기화:
```tsx
<input value={state} onChange={e => setState(e.target.value)} />
```

### Props vs State
- **Props**: 부모로부터 받는 읽기 전용 데이터
- **State**: 컴포넌트 내부에서 관리하는 가변 데이터

## 📖 추가 학습 자료

- [TypeScript 공식 문서](https://www.typescriptlang.org/docs/)
- [React 공식 문서](https://react.dev/)
- [Redux Toolkit 문서](https://redux-toolkit.js.org/)
- [JavaScript MDN](https://developer.mozilla.org/ko/docs/Web/JavaScript)

---

**Tip**: 각 파일의 주석을 순서대로 읽으면서 코드를 따라가면 자연스럽게 개념을 이해할 수 있습니다!
