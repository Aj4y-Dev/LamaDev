import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Relation, UpdateDateColumn } from 'typeorm';
import { CalcMode, RateInput } from '../common/types';
import { Dec } from '../common/utils/decimal';
import { decimalTransformer } from '../common/utils/decimal.transformer';
import { Project } from '../projects/project.entity';
import { EstimateItem } from './estimate-item.entity';

@Entity('estimates')
export class Estimate {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) projectId: string;
  @ManyToOne(() => Project, (p) => p.estimates, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'projectId' }) project: Relation<Project>;
  @Column({ type: 'varchar', length: 12, default: 'draft' }) status: 'draft' | 'confirmed';
  @Column({ type: 'varchar', length: 12, default: 'decimal' }) mode: CalcMode;
  /** Rates the user typed for this estimate, keyed by work type. Kept so confirming reproduces what was shown. */
  @Column({ type: 'jsonb', nullable: true }) rates: Record<string, RateInput> | null;
  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true, transformer: decimalTransformer }) grandTotal: Dec | null;
  @OneToMany(() => EstimateItem, (i) => i.estimate) items: EstimateItem[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
