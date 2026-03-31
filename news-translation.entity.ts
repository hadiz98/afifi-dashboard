import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { News } from './news.entity';

export type NewsLocale = 'en' | 'ar';

@Entity('news_translations')
@Unique(['newsId', 'locale']) // one translation per language
export class NewsTranslation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid', { name: 'news_id' })
  newsId: string;

  @ManyToOne(
    () => News,
    (news) => (news as unknown as { translations: NewsTranslation[] }).translations,
    { onDelete: 'CASCADE' }
  )
  @JoinColumn({ name: 'news_id' })
  news: News;

  @Column({ length: 10 })
  locale: NewsLocale;

  @Column({ length: 200 })
  title: string;

  @Column({ length: 200, default: '' })
  subtitle: string;

  @Column({ type: 'text' })
  description: string;

  /** Localized tags (stored as JSON array in MySQL) */
  @Column({ type: 'json' })
  tags: string[];

  @Column({ type: 'text', nullable: true })
  subDescription: string | null;
}

