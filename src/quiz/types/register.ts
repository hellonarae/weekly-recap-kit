import { registerQuizType } from './index';
import { McqRenderer, BlankRenderer, TfRenderer, ListenChooseRenderer } from './Choice';
import { OrderRenderer, LineOrderRenderer } from './Order';
import { TypeRenderer, MatchRenderer, FlashcardRenderer } from './TypeMatchFlash';

/** Adding a quiz type = schema in scripts/lib/quiz.ts + one registerQuizType call here. */
registerQuizType({ type: 'mcq', Renderer: McqRenderer, summary: (i) => i.prompt });
registerQuizType({ type: 'blank', Renderer: BlankRenderer, summary: (i) => i.sentence });
registerQuizType({ type: 'tf', Renderer: TfRenderer, summary: (i) => i.statement });
registerQuizType({ type: 'order', Renderer: OrderRenderer, summary: (i) => i.prompt });
registerQuizType({ type: 'type', Renderer: TypeRenderer, summary: (i) => i.prompt });
registerQuizType({ type: 'match', Renderer: MatchRenderer, summary: () => 'Match' });
registerQuizType({ type: 'flashcard', Renderer: FlashcardRenderer, summary: (i) => i.tl });
registerQuizType({ type: 'line_order', Renderer: LineOrderRenderer, summary: () => 'Dialogue order' });
registerQuizType({ type: 'listen_choose', Renderer: ListenChooseRenderer, summary: (i) => i.text });
