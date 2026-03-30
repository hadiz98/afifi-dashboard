import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { NewsTranslation } from './news-translation.entity';

@Entity('news')
export class News {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToMany(() => NewsTranslation, (t) => t.news, { cascade: true })
  translations: NewsTranslation[];

  /** Relative path e.g. `/images/news/<filename>` */
  @Column({ type: 'varchar', length: 500, nullable: true })
  image: string | null;

  /** Event/display date — always set by application */
  @Column({ type: 'datetime' })
  date: Date;

  @Column({ default: true })
  isActive: boolean;

  @Index()
  @Column('uuid', { name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ type: 'datetime', nullable: true })
  deletedAt: Date | null;
}
