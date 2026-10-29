import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { RateType, Unit } from '../common/types';
import { Dec } from '../common/utils/decimal';
import { decimalTransformer } from '../common/utils/decimal.transformer';
import { Estimate } from './estimate.entity';

@Entity('estimate_items')
export class EstimateItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) estimateId: string;
  @ManyToOne(() => Estimate, (e) => e.items, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'estimateId' }) estimate: Relation<Estimate>;
  @Column({ type: 'varchar', length: 64 }) categoryKey: string;
  @Column({ type: 'varchar', length: 200, default: '' }) label: string;
  /** Size text exactly as read from the photo, e.g. "10.8". How it is read depends on the calculation mode. */
  @Column({ type: 'varchar', length: 32, nullable: true }) length: string | null;
  @Column({ type: 'varchar', length: 32, nullable: true }) breadth: string | null;
  @Column({ type: 'int', nullable: true }) count: number | null;
  @Column({ type: 'varchar', length: 2, default: 'ft' }) unit: Unit;
  @Column({ type: 'varchar', nullable: true }) photoKey: string | null;
  // Filled when the estimate is confirmed (snapshot, so later rate changes never alter an old estimate).
  @Column({ type: 'numeric', precision: 12, scale: 3, nullable: true, transformer: decimalTransformer }) qty: Dec | null;
  @Column({ type: 'numeric', precision: 14, scale: 4, nullable: true, transformer: decimalTransformer }) rateValue: Dec | null;
  @Column({ type: 'varchar', length: 8, nullable: true }) rateType: RateType | null;
  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true, transformer: decimalTransformer }) amount: Dec | null;
  @Column({ type: 'int', default: 0 }) sortIndex: number;
}
