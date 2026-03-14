import mongoose from 'mongoose';

const bookEntitySchema = new mongoose.Schema(
  {
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
    entity: { type: String, required: true, index: true },
    entityType: {
      type: String,
      required: true,
      enum: ['PERSON', 'ORG', 'GPE', 'LOC', 'EVENT', 'WORK_OF_ART', 'DATE', 'OTHER'],
    },
    frequency: { type: Number, required: true, min: 1 },
  },
  { timestamps: true },
);

bookEntitySchema.index({ bookId: 1, entity: 1 }, { unique: true });
bookEntitySchema.index({ bookId: 1, entityType: 1, frequency: -1 });

export const BookEntity = mongoose.model('BookEntity', bookEntitySchema);
